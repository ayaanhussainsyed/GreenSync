from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
from pymongo import MongoClient
import certifi
import base64
from openai import OpenAI
import torch
from functools import wraps
import os
from PIL import Image, ImageDraw
import io
from datetime import datetime
from bson.objectid import ObjectId
import numpy as np
import json
import yaml
import logging
import re           

app = Flask(__name__)
app.secret_key = '1233'
client = MongoClient(
    "uri",
    tls=True,
    tlsCAFile=certifi.where()
)

db = client['GreenSync']
users_collection = db['user_data']
maps_collection = db['maps']
plants_collection = db['plants']
calibration_collection = db['calibration']
robot_ids = {'greensync_dddbc956', 'greensync_ddd', "test1", "greensync_dddbc961"}

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

client_openai = OpenAI(api_key=OPENAI_API_KEY)
if not OPENAI_API_KEY:
    print("WARNING: OpenAI API key is not configured. Plant identification/disease detection will not work.")

plant_model = None
plant_extractor = None
try:
    os.environ["TRANSFORMERS_NO_TF"] = "1"
    from transformers import AutoModelForImageClassification, AutoFeatureExtractor
    plant_model_path = "final_model"
    plant_model = AutoModelForImageClassification.from_pretrained(plant_model_path)
    plant_extractor = AutoFeatureExtractor.from_pretrained(plant_model_path)
    plant_model.eval()
    print(f"Plant identification model loaded from {plant_model_path}")
except ImportError as e:
    print(f"Warning: ML model dependencies for plant identification not met ({e}). Plant identification functionality might not work.")
except Exception as e:
    print(f"Error loading plant identification model from '{plant_model_path}': {e}. Plant identification functionality might not work.")

disease_model = None
disease_extractor = None
try:
    os.environ["TRANSFORMERS_NO_TF"] = "1"
    from transformers import AutoModelForImageClassification, AutoFeatureExtractor
    disease_model_path = "final_plantD"
    disease_model = AutoModelForImageClassification.from_pretrained(disease_model_path)
    disease_extractor = AutoFeatureExtractor.from_pretrained(disease_model_path)
    disease_model.eval()
    print(f"Disease detection model loaded from {disease_model_path}")
except ImportError as e:
    print(f"Warning: ML model dependencies for disease detection not met ({e}). Disease detection functionality might not work.")
except Exception as e:
    print(f"Error loading disease detection model from '{disease_model_path}': {e}. Plant identification functionality might not work.")

def login_required(f):
    """Decorator to ensure user is logged in."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'username' not in session:
            flash("Please log in to access this page.", "error")
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def robot_access_required(f):
    """Decorator to ensure user has a robot linked to their account."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        username = session.get('username')
        user = users_collection.find_one({'username': username})
        if not user or not user.get('robot'):
            flash("You need a Waraqāʾ robot linked to access this feature. Please link one in your account settings or during onboarding.", "warning")
            return redirect(url_for('home'))
        return f(*args, **kwargs)
    return decorated_function

@app.route('/error', methods=['GET'])
def err():
    return render_template('error.html')

@app.route('/sign-up', methods=['GET', 'POST'])
def sign():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        if users_collection.find_one({'username': username}):
            flash('Username already exists. Try another one.', "warning")
            return redirect(url_for('sign'))
        users_collection.insert_one({'username': username, 'password': password, 'robot': None})
        print(f"Flask Console: Account created for {username}")
        session['username'] = username
        flash('Account created successfully!', 'success')
        return redirect(url_for('q1'))
    return render_template('sign-up.html')

@app.route('/', methods=['GET', 'POST'])
def login():
    if request.method == "POST":
        username = request.form['username']
        password = request.form['password']
        user = users_collection.find_one({'username': username})
        if user and user['password'] == password:
            session['username'] = username
            flash('Login successful!', 'success')
            return redirect(url_for('home'))
        else:
            flash('Invalid username or password.', "error")
            return redirect(url_for("login"))
    return render_template("login.html")

@app.route('/logout')
@login_required
def logout():
    session.pop('username', None)
    flash("You have been logged out.", "info")
    return redirect(url_for('login'))

@app.route('/login-survey-1', methods=['GET', 'POST'])
@login_required
def q1():
    if request.method == 'POST':
        experience = request.form.get('experience')
        username = session.get('username')
        if experience is not None and username:
            users_collection.update_one(
                {'username': username},
                {'$set': {'experience': int(experience)}}
            )
            print(f"Flask Console: Saved experience {experience} for user {username}")
            flash("Experience saved!", "success")
            return redirect(url_for('q2'))
        else:
            flash("Please select your experience level.", "warning")
            return redirect(url_for('q1'))
    return render_template("q1.html")

@app.route('/login-survey-2', methods=['GET', 'POST'])
@login_required
def q2():
    if request.method == 'POST':
        challenges = request.form.getlist('challenge')
        username = session.get('username')
        if challenges and username:
            users_collection.update_one(
                {'username': username},
                {'$set': {'gardening_challenges': challenges}}
            )
            print(f"Flask Console: Saved challenges {challenges} for user {username}")
            flash("Challenges saved!", "success")
            return redirect(url_for('q3'))
        else:
            flash("Please select at least one challenge.", "warning")
            return redirect(url_for('q2'))
    return render_template('q2.html')

@app.route('/login-survey-3', methods=['GET', 'POST'])
@login_required
def q3():
    if request.method == "POST":
        zones = request.form.getlist("zone")
        username = session.get("username")
        if zones and username:
            users_collection.update_one(
                {'username': username},
                {'$set': {'zone': zones}}
            )
            print(f"Flask Console: Saved zone for user {username}")
            flash("Zones saved!", "success")
            return redirect(url_for('robot_check'))
        else:
            flash("Please select at least one zone.", "warning")
            return redirect(url_for('q3'))
    return render_template("q3.html")

@app.route('/robot-method', methods=['GET', 'POST'])
@login_required
def robot_check():
    username = session.get('username')
    if request.method == 'POST':
        has_robot = request.form.get('has_robot')
        robot_id_input = request.form.get('robot_id')
        final_robot_id_to_save = None
        if has_robot == 'yes':
            if robot_id_input and robot_id_input in robot_ids:
                final_robot_id_to_save = robot_id_input
                flash("Robot ID successfully validated!", "success")
            else:
                flash("Invalid Robot ID. Please try again or select 'No'.", "error")
                return render_template("robot_check.html")
        elif has_robot == 'no':
            flash("No robot selected. Proceeding without Waraqa.", "info")
            final_robot_id_to_save = None
        users_collection.update_one(
            {'username': username},
            {'$set': {'robot': final_robot_id_to_save}}
        )
        print(f"Flask Console: Saved robot info for user {username}: {final_robot_id_to_save}")
        return redirect(url_for('transition'))
    return render_template("robot_check.html")

@app.route('/onboarding-done')
@login_required
def transition():
    return render_template("trans.html")

@app.route('/home')
@login_required
def home():
    username = session.get('username')
    user = users_collection.find_one({'username': username})
    plants_for_template = []
    if user and user.get('robot'):
        robot_id = user['robot']
        plants_cursor = plants_collection.find({'username': username, 'robot_id': robot_id}).limit(4)
        for plant in plants_cursor:
            plant['_id'] = str(plant['_id'])  # Convert ObjectId to string
            plants_for_template.append(plant)
    return render_template("home.html", user=user, plants=plants_for_template)

@app.route('/ask-ai')
@login_required
def ai():
    return render_template("plant_advisor.html")

@app.route('/disease-detection')
@login_required
def disease_detection():
    return render_template("plant_diagnosis.html")

@app.route('/predict', methods=['POST'])
@login_required
def predict():
    if not plant_model or not plant_extractor:
        return jsonify({'error': 'Plant identification model not loaded. Prediction unavailable.'}), 500
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    file = request.files['image']
    if not file.filename:
        return jsonify({'error': 'No selected file'}), 400
    try:
        image = Image.open(file.stream).convert("RGB")
    except Exception as e:
        return jsonify({'error': f'Failed to open image: {e}'}), 400
    try:
        inputs = plant_extractor(images=image, return_tensors="pt")
    except Exception as e:
        return jsonify({'error': f'Failed to preprocess image: {e}'}), 500
    with torch.no_grad():
        try:
            outputs = plant_model(**inputs)
            logits = outputs.logits
            predicted_class_idx = logits.argmax(-1).item()
            predicted_label = plant_model.config.id2label[predicted_class_idx]
        except Exception as e:
            return jsonify({'error': f'Model prediction failed: {e}'}), 500
    print("Convolutional Layer Computed for Plant Identification")
    return jsonify({'prediction': predicted_label})

@app.route('/predict_disease', methods=['POST'])
@login_required
def predict_disease():
    if not disease_model or not disease_extractor:
        return jsonify({'error': 'Disease detection model not loaded. Prediction unavailable.'}), 500
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    file = request.files['image']
    if not file.filename:
        return jsonify({'error': 'No selected file'}), 400
    try:
        image = Image.open(file.stream).convert("RGB")
    except Exception as e:
        return jsonify({'error': f'Failed to open image: {e}'}), 400
    try:
        inputs = disease_extractor(images=image, return_tensors="pt")
    except Exception as e:
        return jsonify({'error': f'Failed to preprocess image: {e}'}), 500
    with torch.no_grad():
        try:
            outputs = disease_model(**inputs)
            logits = outputs.logits
            predicted_class_idx = logits.argmax(-1).item()
            predicted_label = disease_model.config.id2label[predicted_class_idx]
        except Exception as e:
            return jsonify({'error': f'Model prediction failed: {e}'}), 500
    print("Convolutional Layer Computed for Disease Detection")
    return jsonify({'prediction': predicted_label})

@app.route('/control-panel')
@login_required
@robot_access_required
def cp():
    username = session.get('username')
    user = users_collection.find_one({'username': username})
    return render_template("robot_hub.html", user=user)

@app.route('/debug_map/<robot_id>')
def debug_map(robot_id):
    latest_map = maps_collection.find_one({'robot_id': robot_id}, sort=[('timestamp', -1)])
    if not latest_map:
        return 'No map found.'
    pgm_b64 = latest_map.get('map_data_pgm')
    if not pgm_b64:
        return 'No map_data_pgm found.'
    try:
        pgm_text = base64.b64decode(pgm_b64).decode('ascii')
        return f"<pre>{pgm_text[:2000]}</pre>"
    except Exception as e:
        return f"Error decoding: {str(e)}"

def generate_pgm_p2_base64(array_2d):
    height, width = array_2d.shape
    header = f"P2\n{width} {height}\n255\n"
    body = '\n'.join(' '.join(str(int(val)) for val in row) for row in array_2d)
    pgm_ascii = header + body
    return base64.b64encode(pgm_ascii.encode('ascii')).decode('utf-8')

def convert_pgm_p5_to_p2(pgm_binary_bytes):
    parts = re.split(rb'\s+', pgm_binary_bytes, maxsplit=4)
    if parts[0] != b'P5':
        raise ValueError("Not a binary P5 PGM file")
    width = int(parts[1])
    height = int(parts[2])
    maxval = int(parts[3])
    if maxval != 255:
        raise ValueError("Expected maxval 255 in PGM")
    pixel_data = parts[4]
    if len(pixel_data) != width * height:
        raise ValueError("Pixel data length mismatch")
    lines = ["P2", f"{width} {height}", str(maxval)]
    for y in range(height):
        row = []
        for x in range(width):
            row.append(str(pixel_data[y * width + x]))
        lines.append(" ".join(row))
    return "\n".join(lines)


@app.route('/get_latest_map/<robot_id>')
def get_latest_map(robot_id):
    app.logger.info(f"Fetching map for robot_id: {robot_id}")
    try:
        map_doc = maps_collection.find_one(
            {"robot_id": robot_id},
            sort=[("timestamp", -1)]
        )
        if not map_doc:
            app.logger.warning(f"No map found for robot {robot_id}")
            return jsonify({"error": "No map found"}), 404

        img_b64 = map_doc.get("map_data_pgm")
        yaml_b64 = map_doc.get("map_metadata_yaml")
        if not img_b64 or not yaml_b64:
            app.logger.error(f"Missing map data or metadata for robot {robot_id}")
            return jsonify({"error": "Map data or metadata missing"}), 400

        # Decode PGM and convert to PNG
        pgm_data = base64.b64decode(img_b64)
        if pgm_data.startswith(b'P2'):
            app.logger.info("Processing P2 PGM")
            img = Image.open(io.BytesIO(pgm_data))
        elif pgm_data.startswith(b'P5'):
            app.logger.info("Processing P5 PGM")
            header = pgm_data.split(b'\n', 3)[0:3]
            width, height = map(int, header[1].split())
            maxval = int(header[2])
            pixel_data = pgm_data.split(b'\n', 3)[3]
            img = Image.frombytes('L', (width, height), pixel_data)
        else:
            app.logger.warning(f"Invalid PGM format for robot {robot_id}. Trying fallback.")
            raw_array = map_doc.get('map_array')
            if raw_array and isinstance(raw_array, list):
                app.logger.info("Generating PGM from map_array")
                array_np = np.array(raw_array, dtype=np.uint8)
                height, width = array_np.shape
                img = Image.fromarray(array_np, mode='L')
            else:
                app.logger.error(f"No valid map data or array for robot {robot_id}")
                return jsonify({"error": "Corrupt or missing map data. Please calibrate."}), 400

        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='PNG')
        img_b64_png = base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')

        metadata_yaml = base64.b64decode(yaml_b64).decode("utf-8")
        metadata = yaml.safe_load(metadata_yaml) or {}
        metadata["height_px"] = map_doc.get("height", 200)
        metadata["width_px"] = map_doc.get("width", 200)
        metadata["resolution"] = float(metadata.get("resolution", 0.05))
        metadata["origin"] = [float(metadata.get("origin", [-10, -10])[0]), float(metadata.get("origin", [-10, -10])[1])]

        app.logger.info(f"Successfully processed map for robot {robot_id}")
        return jsonify({
            "map_data_pgm_b64": f"data:image/png;base64,{img_b64_png}",
            "map_metadata": metadata,
            "width": map_doc["width"],
            "height": map_doc["height"]
        })
    except Exception as e:
        app.logger.error(f"Map fetch error for robot {robot_id}: {e}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

@app.route('/identify_plant_api', methods=['POST'])
@login_required
def identify_plant_api():
    data = request.get_json()
    plant_name_cnn = data.get('plant_name_cnn')
    image_b64 = data.get('image_b64')
    if not OPENAI_API_KEY:
        return jsonify({'error': 'OpenAI API key not configured on server.'}), 500
    plant_info_display_paragraph = "No detailed information available for this plant."
    plant_info_structured_data = {}
    opening_phrase = "Here's what our AI found about your plant!"
    identified_common_name = "Unknown Plant"
    try:
        if image_b64:
            print("Flask Console: Calling OpenAI Vision API from /identify_plant_api with image...")
            vision_response = client_openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": (
                                    "You are a plant expert. Identify the plant in the image. "
                                    "Provide detailed information about this plant in a single, flowing HTML paragraph. "
                                    "Include its common name, genus, family, a very concise one-sentence description, and its typical habitat. "
                                    "Format the output using HTML tags like <strong> for labels (e.g., '<strong>Common Name:</strong>'). "
                                    "Ensure the paragraph is grammatically correct and flows naturally. "
                                    "For any piece of information (e.g., genus, family, description, habitat) that cannot be identified, "
                                    "use 'Unknown' or 'Not Specified' for that field within the paragraph."
                                    "\n\n"
                                    "Additionally, generate a friendly and grammatically correct introductory sentence about the plant, "
                                    "using its common name, for example: 'What a magnificent [Common Name]!', "
                                    "'Here's some information about the lovely [Common Name].', or 'Discovering the [Common Name]!' "
                                    "This sentence should be returned as a separate field named 'opening_phrase' within the JSON."
                                    "\n\n"
                                    "Also, provide the structured plant data (common_name, genus, family, description, habitat) in a separate JSON object "
                                    "under the key 'plant_info_structured'. This is for database storage later. "
                                    "If a field is unknown, use 'Unknown' or 'Not Specified'."
                                    "\n\n"
                                    "STRICTLY respond with a JSON object that includes three keys: "
                                    "'plant_info_display' (containing the single HTML paragraph), "
                                    "'plant_info_structured' (containing the structured JSON object), and "
                                    "'opening_phrase' (containing the introductory sentence)."
                                    "\n\n"
                                    "Example JSON structure:"
                                    '{"plant_info_display": "<strong>Common Name:</strong> Example Plant. <strong>Genus:</strong> ExampleGenus. '
                                    'Family:</strong> ExampleFamily. <strong>Description:</strong> A very concise, single-sentence summary. '
                                    '<strong>Habitat:</strong> Typical habitat.", '
                                    '"plant_info_structured": {"common_name": "Example Plant", "genus": "ExampleGenus", "family": "ExampleFamily", '
                                    '"description": "A very concise, single-sentence summary.", "habitat": "Typical habitat."}, '
                                    '"opening_phrase": "What a magnificent Example Plant!"}'
                                )
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{image_b64}",
                                    "detail": "high"
                                },
                            },
                        ],
                    }
                ],
                max_tokens=500,
                response_format={"type": "json_object"}
            )
            ai_response_json_str = vision_response.choices[0].message.content
        elif plant_name_cnn:
            print(f"Flask Console: Calling OpenAI API for info on '{plant_name_cnn}'...")
            text_response = client_openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": (
                                    f"You are a plant expert. The plant identified is '{plant_name_cnn}'. "
                                    "Please provide detailed information about this plant in a single, flowing HTML paragraph. "
                                    "Include its common name, genus, family, a very concise one-sentence description, and its typical habitat. "
                                    "Format the output using HTML tags like <strong> for labels (e.g., '<strong>Common Name:</strong>'). "
                                    "Ensure the paragraph is grammatically correct and flows naturally. "
                                    "For any piece of information (e.g., genus, family, description, habitat) that cannot be identified, "
                                    "use 'Unknown' or 'Not Specified' for that field within the paragraph."
                                    "\n\n"
                                    "Additionally, generate a friendly and grammatically correct introductory sentence about the plant, "
                                    "using its common name, for example: 'What a magnificent [Common Name]!', "
                                    "'Here's some information about the lovely [Common Name].', or 'Discovering the [Common Name]!' "
                                    "This sentence should be returned as a separate field named 'opening_phrase' within the JSON."
                                    "\n\n"
                                    "Also, provide the structured plant data (common_name, genus, family, description, habitat) in a separate JSON object "
                                    "under the key 'plant_info_structured'. This is for database storage later. "
                                    "If a field is unknown, use 'Unknown' or 'Not Specified'."
                                    "\n\n"
                                    "STRICTLY respond with a JSON object that includes three keys: "
                                    "'plant_info_display' (containing the single HTML paragraph), "
                                    "'plant_info_structured' (containing the structured JSON object), and "
                                    "'opening_phrase' (containing the introductory sentence)."
                                    "\n\n"
                                    "Example JSON structure:"
                                    '{"plant_info_display": "<strong>Common Name:</strong> Example Plant. <strong>Genus:</strong> ExampleGenus. '
                                    'Family:</strong> ExampleFamily. <strong>Description:</strong> A very concise, single-sentence summary. '
                                    '<strong>Habitat:</strong> Typical habitat.", '
                                    '"plant_info_structured": {"common_name": "Example Plant", "genus": "ExampleGenus", "family": "ExampleFamily", '
                                    '"description": "A very concise, single-sentence summary.", "habitat": "Typical habitat."}, '
                                    '"opening_phrase": "What a magnificent Example Plant!"}'
                                )
                            },
                        ],
                    }
                ],
                max_tokens=500,
                response_format={"type": "json_object"}
            )
            ai_response_json_str = text_response.choices[0].message.content
        else:
            return jsonify({'error': 'No image or plant name provided for AI identification.'}), 400
        if not ai_response_json_str:
            print(f"Flask Console ERROR: OpenAI API returned empty or None content.")
            return jsonify({'error': 'AI response was empty. Could not identify plant.'}), 500
        print(f"Flask Console: Raw OpenAI JSON response: {ai_response_json_str}")
        try:
            plant_data_response = json.loads(ai_response_json_str)
        except json.JSONDecodeError as e:
            print(f"Flask Console ERROR: Failed to parse OpenAI JSON response: {ai_response_json_str}. Error: {e}")
            return jsonify({'error': 'AI response malformed. Could not identify plant.'}), 500
        plant_info_display_paragraph = plant_data_response.get("plant_info_display", "No detailed information available for this plant.")
        plant_info_structured_data = plant_data_response.get("plant_info_structured", {})
        opening_phrase = plant_data_response.get("opening_phrase", f"Here's what our AI found about your plant!")
        if "common_name" not in plant_info_structured_data or not plant_info_structured_data["common_name"]:
            if plant_name_cnn:
                plant_info_structured_data["common_name"] = plant_name_cnn
            else:
                match = re.search(r'<strong>Common Name:</strong>\s*([^<.]+)', plant_info_display_paragraph)
                if match:
                    plant_info_structured_data["common_name"] = match.group(1).strip()
                else:
                    plant_info_structured_data["common_name"] = "Unknown Plant"
        identified_common_name = plant_info_structured_data.get("common_name", "Unknown Plant")
        return jsonify({
            'success': True,
            'plant_name': identified_common_name,
            'plant_info_display': plant_info_display_paragraph,
            'plant_info_structured': plant_info_structured_data,
            'opening_phrase': opening_phrase
        }), 200
    except Exception as e:
        print(f"Flask Console ERROR: OpenAI API call failed in /identify_plant_api: {e}")
        return jsonify({'error': f'Error identifying plant: {e}. Please try again later.'}), 500

@app.route('/get_disease_info', methods=['POST'])
@login_required
def get_disease_info():
    data = request.get_json()
    disease_name_cnn = data.get('disease_name_cnn')
    if not disease_name_cnn:
        return jsonify({'error': 'No disease name provided for AI description.'}), 400
    if not OPENAI_API_KEY:
        return jsonify({'error': 'OpenAI API key not configured on server.'}), 500
    try:
        print(f"Flask Console: Calling OpenAI API for info on disease '{disease_name_cnn}'...")
        response = client_openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                f"You are a plant pathologist. The disease identified by a CNN is '{disease_name_cnn}'. "
                                "Please provide a concise description of this disease in a few sentences, suitable for a general audience. "
                                "Focus on what the disease is, its common symptoms, and general impact. "
                                "Format the output as a single, flowing HTML paragraph. "
                                "For example: '<strong>Disease:</strong> [Disease Name]. This disease is caused by... Symptoms include... It can impact...'"
                                "\n\n"
                                "Additionally, generate a direct introductory sentence about the disease, "
                                "for example: 'The disease is [Disease Name].', 'Our analysis indicates [Disease Name].', or 'Diagnosed with [Disease Name]!' "
                                "This sentence should be returned as a separate field named 'opening_phrase' within the JSON."
                                "\n\n"
                                "STRICTLY respond with a JSON object that includes two keys: "
                                "'disease_info_display' (containing the single HTML paragraph), and "
                                "'opening_phrase' (containing the introductory sentence)."
                                "\n\n"
                                "Example JSON structure:"
                                '{"disease_info_display": "<strong>Disease:</strong> Apple Scab. This fungal disease causes olive-green spots on leaves and fruit. It can lead to defoliation and reduced fruit quality.", '
                                '"opening_phrase": "The disease is Apple Scab."}'
                            )
                        },
                    ],
                }
            ],
            max_tokens=300,
            response_format={"type": "json_object"}
        )
        ai_response_json_str = response.choices[0].message.content
        if not ai_response_json_str:
            print(f"Flask Console ERROR: OpenAI API returned empty or None content for disease info.")
            return jsonify({'error': 'AI response was empty. Could not get disease info.'}), 500
        print(f"Flask Console: Raw OpenAI JSON response for disease: {ai_response_json_str}")
        try:
            disease_data_response = json.loads(ai_response_json_str)
        except json.JSONDecodeError as e:
            print(f"Flask Console ERROR: Failed to parse OpenAI JSON response for disease: {ai_response_json_str}. Error: {e}")
            return jsonify({'error': 'AI response malformed. Could not get disease info.'}), 500
        disease_info_display_paragraph = disease_data_response.get("disease_info_display", "No detailed information available for this disease.")
        opening_phrase = disease_data_response.get("opening_phrase", f"Here's what our AI found about {disease_name_cnn}!")
        return jsonify({
            'success': True,
            'disease_info_display': disease_info_display_paragraph,
            'opening_phrase': opening_phrase
        }), 200
    except Exception as e:
        print(f"Flask Console ERROR: OpenAI API call failed in /get_disease_info: {e}")
        return jsonify({'error': f'Error getting disease info: {e}. Please try again later.'}), 500

@app.route('/add-a-plant', methods=['GET', 'POST'])
@login_required
@robot_access_required
def introduce_plant():
    username = session.get('username')
    user = users_collection.find_one({'username': username})
    robot_id = user.get('robot')
    if request.method == 'POST':
        plant_picture_file = request.files.get('plant_picture')
        plant_number_str = request.form.get('plant_number')
        location_x_str = request.form.get('location_x')
        location_y_str = request.form.get('location_y')
        identified_plant_name = request.form.get('identified_plant_name')
        identified_plant_info_json_str = request.form.get('identified_plant_info')
        if not plant_picture_file or not plant_number_str or location_x_str is None or location_y_str is None or not identified_plant_name or not identified_plant_info_json_str:
            flash("Please provide all required information: map location, plant picture, identified plant info, and plant number.", "error")
            return redirect(url_for('introduce_plant'))
        try:
            plant_number = int(plant_number_str)
            if plant_number <= 0:
                flash("Plant number must be a positive whole number.", "error")
                return redirect(url_for('introduce_plant'))
            location_x = float(location_x_str)
            location_y = float(location_y_str)
        except ValueError:
            flash("Invalid input for plant number or location coordinates. Please ensure they are valid numbers.", "error")
            return redirect(url_for('introduce_plant'))
        plant_picture_b64 = None
        if plant_picture_file:
            try:
                img = Image.open(plant_picture_file.stream).convert("RGB")
                img_byte_arr = io.BytesIO()
                img.save(img_byte_arr, format='PNG')
                img_byte_arr.seek(0)
                plant_picture_b64 = base64.b64encode(img_byte_arr.read()).decode('utf-8')
            except Exception as e:
                flash(f"Error processing plant picture for storage: {e}", "error")
                return redirect(url_for('introduce_plant'))
        try:
            plant_info_for_db = json.loads(identified_plant_info_json_str)
        except json.JSONDecodeError as e:
            flash(f"Error parsing structured plant info: {e}", "error")
            print(f"Flask Console ERROR: Failed to parse identified_plant_info_json_str: {identified_plant_info_json_str}. Error: {e}")
            return redirect(url_for('introduce_plant'))
        try:
            plant_doc = {
                "username": username,
                "robot_id": robot_id,
                "plant_picture": plant_picture_b64,
                "plant_name": identified_plant_name,
                "plant_info": plant_info_for_db,
                "location": {
                    "x": location_x,
                    "y": location_y
                },
                "plant_number": plant_number,
                "task": None,
                "timestamp": datetime.now()
            }
            plants_collection.insert_one(plant_doc)
            flash("Plant introduced successfully!", "success")
            print(f"Flask Console: Plant '{identified_plant_name}' (ID: {plant_number}) saved for robot '{robot_id}'.")
            return redirect(url_for('cp'))
        except Exception as e:
            flash(f"Error saving plant data: {e}", "error")
            print(f"Flask Console ERROR: MongoDB save failed: {e}")
            return redirect(url_for('introduce_plant'))
    return render_template("introduce_plant.html", robot_id=robot_id)

@app.route('/start_calibration', methods=['POST'])
@login_required
def start_calibration():
    username = session.get('username')
    user = users_collection.find_one({'username': username})
    if not user:
        return jsonify({'success': False, 'error': 'User not found'}), 404
    robot_id = user.get('robot')
    if not robot_id:
        return jsonify({'success': False, 'error': 'Robot ID missing'}), 400
    calibration_collection.update_one(
        {'robot_id': robot_id},
        {'$set': {'calibration': 1, 'timestamp': datetime.utcnow()}},
        upsert=True
    )
    return jsonify({'success': True})

@app.route("/assign-tasks")
@login_required
@robot_access_required
def assign_tasks():
    username = session.get('username')
    user = users_collection.find_one({'username': username})
    robot_id = user.get('robot')
    plants = list(plants_collection.find({'robot_id': robot_id}))
    return render_template('assign_tasks.html', plants=plants)

@app.route("/assign-task-form/<plant_id>")
@login_required
@robot_access_required
def assign_task_form(plant_id):
    plant = plants_collection.find_one({'_id': ObjectId(plant_id)})
    if not plant:
        flash("Plant not found.", "error")
        return redirect(url_for('assign_tasks'))
    return render_template('assign_task_form.html', plant=plant)

@app.route("/assign_task_to_plant", methods=["POST"])
@login_required
@robot_access_required
def assign_task_to_plant():
    plant_id = request.form.get('plant_id')
    task_type = request.form.get('task_type')
    if not plant_id or not task_type:
        flash("Missing plant ID or task type.", "error")
        return redirect(url_for('assign_tasks'))
    try:
        plants_collection.update_one(
            {'_id': ObjectId(plant_id)},
            {'$set': {'task': task_type}}
        )
        flash(f"Task '{task_type}' assigned to plant successfully!", "success")
    except Exception as e:
        flash(f"Error assigning task: {e}", "error")
    return redirect(url_for('assign_tasks'))

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def process_image_for_ai(image_data_base64):
    try:
        image_bytes = base64.b64decode(image_data_base64)
        image = Image.open(io.BytesIO(image_bytes))
        image = image.convert("RGB")
        # Resize for AI model processing (if needed)
        image_for_ai = image.resize((224, 224))
        # Keep original image for frontend display
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='JPEG', quality=85)  # Use JPEG for better compatibility
        img_byte_arr.seek(0)
        image_data_base64_for_frontend = base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')
        logging.info("Image processed for AI model and frontend display.")
        return image_data_base64_for_frontend
    except Exception as e:
        logging.error(f"Error processing image for AI in process_image_for_ai: {e}")
        return None

@app.route('/gardening-tips')
@login_required
def gardening_tips_page():
    username = session.get('username')
    user = users_collection.find_one({'username': username})
    return render_template('waraqa.html', user=user)

@app.route('/get_gardening_tips', methods=['POST'])
@login_required
def get_gardening_tips():
    try:
        data = request.get_json()
        user_prompt = data.get('prompt', '')
        image_data_base64 = data.get('image', None)
        is_first_prompt_in_conversation = data.get('is_first_prompt', True)
        chat_history = session.get('chat_history', [])
        logging.info(f"Received request: Prompt='{user_prompt}', Image_present={bool(image_data_base64)}")
        current_openai_message_content = []
        if user_prompt:
            current_openai_message_content.append({"type": "text", "text": user_prompt})
        generated_image_url_for_frontend = None
        if image_data_base64:
            logging.info("Image data received. Attempting to process image for AI.")
            processed_image_info = process_image_for_ai(image_data_base64)
            if processed_image_info:
                current_openai_message_content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{processed_image_info}"}})
                generated_image_url_for_frontend = f"data:image/jpeg;base64,{processed_image_info}"
                logging.info("Image successfully prepared for OpenAI API and frontend.")
            else:
                logging.error("Failed to process image in process_image_for_ai function.")
                return jsonify({'error': 'Failed to process image. Please ensure the image is valid and try again.'}), 400
        if not user_prompt and not image_data_base64:
            logging.warning("No prompt or image provided in the request.")
            return jsonify({'error': 'No prompt or image provided.'}), 400
        messages = [
            {"role": "system", "content": "You are a helpful gardening assistant called GreenBrain. Provide concise and informative answers. If the user provides an image, analyze it in context of their query."},
        ]
        for msg in chat_history:
            if msg['role'] == 'user':
                user_msg_content = []
                if isinstance(msg['content'], dict):
                    if 'text' in msg['content']:
                        user_msg_content.append({"type": "text", "text": msg['content']['text']})
                    if 'image_url' in msg['content'] and msg['content']['image_url']:
                        user_msg_content.append({"type": "image_url", "image_url": {"url": msg['content']['image_url']}})
                else:
                    user_msg_content.append({"type": "text", "text": msg['content']})
                messages.append({"role": "user", "content": user_msg_content})
            else:
                messages.append({"role": "assistant", "content": msg['content']})
        messages.append({"role": "user", "content": current_openai_message_content})
        logging.info(f"Sending messages to OpenAI (GreenBrain), including {len(current_openai_message_content)} parts in current user message.")
        logging.debug(f"Full OpenAI messages payload: {messages}")
        response = client_openai.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=500,
            temperature=0.7,
        )
        ai_response_content = response.choices[0].message.content
        logging.info(f"Raw OpenAI response received (GreenBrain): {ai_response_content[:100]}...")
        logging.debug(f"Full OpenAI response (GreenBrain): {ai_response_content}")
        if not ai_response_content:
            logging.warning("AI response was empty.")
            return jsonify({'error': 'AI response was empty. Please try again.'}), 500
        user_message_to_store = {"text": user_prompt, "image_url": generated_image_url_for_frontend}
        chat_history.append({"role": "user", "content": user_message_to_store})
        chat_history.append({"role": "assistant", "content": ai_response_content})
        session['chat_history'] = chat_history
        logging.info("Successfully processed request and generated AI response.")
        return jsonify({
            'success': True,
            'response': ai_response_content,
            'image_url': generated_image_url_for_frontend
        }), 200
    except Exception as e:
        logging.exception(f"OpenAI API call failed in get_gardening_tips: {e}")
        return jsonify({'error': f'Error getting gardening tips: {e}. Please try again or contact support.'}), 500

@app.route('/create_journal', methods=['POST'])
@login_required
def create_journal():
    try:
        data = request.get_json()
        chat_history = data.get('chat_history', [])
        summary_prompt_messages = [
            {"role": "system", "content": "You are a helpful assistant. Summarize the following gardening conversation and extract any actionable tasks. For tasks, provide a description. Do not include images in the summary."},
            {"role": "user", "content": "Here is the conversation:\n" + json.dumps(chat_history, indent=2)}
        ]
        summary_response = client_openai.chat.completions.create(
            model="gpt-4o",
            messages=summary_prompt_messages,
            response_format={"type": "json_object"},
            max_tokens=1000
        )
        ai_journal_content = json.loads(summary_response.choices[0].message.content)
        summary_text = ai_journal_content.get("summary", "No summary available.")
        extracted_tasks = ai_journal_content.get("tasks", [])
        return jsonify({
            'success': True,
            'summary': summary_text,
            'tasks': extracted_tasks
        }), 200
    except Exception as e:
        logging.exception("Error creating journal")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/autopsy')
@login_required
@robot_access_required 
def autopsy_page(): 
    username = session.get('username')
    user = users_collection.find_one({'username': username})
    robot_id = user.get('robot')
    plants_cursor = plants_collection.find({'robot_id': robot_id})
    plants_for_template = []
    for plant in plants_cursor:
        plant['_id'] = str(plant['_id']) 
        plants_for_template.append(plant)

    return render_template("autopsy.html", plants=plants_for_template)

@app.route('/perform_autopsy', methods=['POST'])
@login_required
@robot_access_required
def perform_autopsy():
    try:
        data = request.get_json()
        selected_plant_id = data.get('selected_plant_id')
        watering_history = data.get('watering_history')
        light_exposure = data.get('light_exposure')
        has_pest_disease = data.get('has_pest_disease')
        disease_name = data.get('disease_name')
        plant_picture_b64 = data.get('plant_picture_b64')

        if not OPENAI_API_KEY:
            return jsonify({'success': False, 'error': 'OpenAI API key not configured.'}), 500

        # Construct the prompt for OpenAI
        prompt_text = (
            "You are a highly experienced plant pathologist and botanist. "
            "Analyze the provided plant image and the following care history details to determine the most probable cause of the plant's demise or severe decline. "
            "Provide a detailed autopsy report and a semantic map of the causes and contributing conditions.\n\n"
            f"Plant ID/Name: {selected_plant_id}\n"
            f"Watering History: {watering_history}\n"
            f"Light Exposure: {light_exposure}\n"
            f"Pest/Disease History: {'Yes, ' + disease_name if has_pest_disease == 'yes' else 'No'}\n\n"
            "Based on this information and the image, identify the primary cause and any interconnected contributing conditions. "
            "Your response MUST be a JSON object with two keys: 'autopsy_report' (a detailed HTML formatted string explaining the findings, "
            "using strong tags for emphasis, e.g., '<strong>Cause:</strong>', '<strong>Contributing Factors:</strong>') "
            "and 'semantic_map' (an object with a 'cause' key for the main issue and a 'conditions' key as an array of related conditions). "
            "Ensure the 'autopsy_report' is comprehensive and easy to understand for a plant owner. "
            "If no specific cause can be determined, state that clearly in the report and provide general advice. "
            "Example JSON structure for semantic_map: "
            '{"cause": "Root Rot", "conditions": ["Overwatering", "Poor Drainage", "Fungal Infection"]}'
        )

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt_text}
                ]
            }
        ]

        if plant_picture_b64:
            messages[0]["content"].append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/png;base64,{plant_picture_b64}",
                    "detail": "high"
                }
            })
        
        logging.info("Calling OpenAI Vision API for plant autopsy.")
        openai_response = client_openai.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            response_format={"type": "json_object"},
            max_tokens=1500
        )
        
        ai_content_str = openai_response.choices[0].message.content
        logging.info(f"Raw OpenAI Autopsy Response: {ai_content_str[:500]}...")

        try:
            autopsy_result = json.loads(ai_content_str)
        except json.JSONDecodeError as e:
            logging.error(f"Failed to parse OpenAI JSON response for autopsy: {e}. Raw response: {ai_content_str}")
            return jsonify({'success': False, 'error': 'AI response malformed. Please try again.'}), 500

        autopsy_report = autopsy_result.get('autopsy_report', 'No autopsy report generated.')
        semantic_map_data = autopsy_result.get('semantic_map', {'cause': 'Unknown Cause', 'conditions': ['Insufficient data']})

        return jsonify({
            'success': True,
            'autopsy_report': autopsy_report,
            'semantic_map': semantic_map_data
        }), 200

    except Exception as e:
        logging.exception("Error performing plant autopsy:")
        return jsonify({'success': False, 'error': f'An error occurred during autopsy: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(debug=True, port=7379)