const diseaseLabelMap = {
    '0': 'Apple___Apple_scab', '1': 'Apple___Black_rot', '2': 'Apple___Cedar_apple_rust', '3': 'Apple___healthy', 
    '4': 'Blueberry___healthy', '5': 'Cherry_(including_sour)___Powdery_mildew', '6': 'Cherry_(including_sour)___healthy', 
    '7': 'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot', '8': 'Corn_(maize)___Common_rust_', 
    '9': 'Corn_(maize)___Northern_Leaf_Blight', '10': 'Corn_(maize)___healthy', '11': 'Grape___Black_rot', 
    '12': 'Grape___Esca_(Black_Measles)', '13': 'Grape___Leaf_blight_(Isariopsis_Leaf_Spot)', '14': 'Grape___healthy', 
    '15': 'Orange___Haunglongbing_(Citrus_greening)', '16': 'Peach___Bacterial_spot', '17': 'Peach___healthy', 
    '18': 'Pepper,_bell___Bacterial_spot', '19': 'Pepper,_bell___healthy', '20': 'Potato___Early_blight', 
    '21': 'Potato___Late_blight', '22': 'Potato___healthy', '23': 'Raspberry___healthy', '24': 'Soybean___healthy', 
    '25': 'Squash___Powdery_mildew', '26': 'Strawberry___Leaf_scorch', '27': 'Strawberry___healthy', 
    '28': 'Tomato___Bacterial_spot', '29': 'Tomato___Early_blight', '30': 'Tomato___Late_blight', 
    '31': 'Tomato___Leaf_Mold', '32': 'Tomato___Septoria_leaf_spot', '33': 'Tomato___Spider_mites Two-spotted_spider_mite', 
    '34': 'Tomato___Target_Spot', '35': 'Tomato___Tomato_Yellow_Leaf_Curl_Virus', '36': 'Tomato___Tomato_mosaic_virus', 
    '37': 'Tomato___healthy'
};

// Function to smoothly show an element
function fadeInElement(element, displayStyle = 'block') {
    element.style.opacity = 0;
    element.style.display = displayStyle;
    setTimeout(() => {
        element.style.transition = 'opacity 1s ease-in-out';
        element.style.opacity = 1;
    }, 10); // Small delay to ensure display change takes effect before transition
}

// Function to smoothly hide an element
function fadeOutElement(element) {
    element.style.transition = 'opacity 0.5s ease-in-out';
    element.style.opacity = 0;
    setTimeout(() => {
        element.style.display = 'none';
    }, 500); // Wait for transition to complete before hiding
}

document.addEventListener('DOMContentLoaded', function() {
    // Add fade-in class to body when DOM is loaded
    document.body.classList.add('fade-in');

    const fileInput = document.getElementById('fileInput');
    const predictionContainer = document.getElementById('predictionContainer');
    const predictionTextElement = document.getElementById('predictionText');
    const loaderContainer = document.getElementById('loaderContainer');
    const diseaseInfoContainer = document.getElementById('diseaseInfoContainer'); // Changed from plantInfoContainer
    const gptOutputText = document.getElementById('gptOutputText'); // Div for GPT output paragraph

    fileInput.addEventListener('change', async function() {
        const file = this.files[0];
        if (!file) {
            console.log("No file selected.");
            return;
        }

        // Hide previous GPT info if any
        fadeOutElement(diseaseInfoContainer);
        
        // Show loader (it will fade in)
        fadeInElement(loaderContainer, 'flex'); 

        const formData = new FormData();
        formData.append('image', file);

        try {
            // Step 1: Get prediction from CNN model (Flask backend) for disease
            const predictResponse = await fetch('/predict_disease', { // New endpoint for disease prediction
                method: 'POST',
                body: formData
            });

            if (!predictResponse.ok) {
                throw new Error(`HTTP error! status: ${predictResponse.status}`);
            }
            const predictResult = await predictResponse.json();
            const predictionString = predictResult.prediction;

            let meaningfulLabel = 'Unknown Disease';
            let extractedLabelNumberString = null;

            if (predictionString && typeof predictionString === 'string' && predictionString.startsWith('LABEL_')) {
                extractedLabelNumberString = predictionString.replace('LABEL_', '');
            }

            if (extractedLabelNumberString !== null && diseaseLabelMap.hasOwnProperty(extractedLabelNumberString)) {
                meaningfulLabel = diseaseLabelMap[extractedLabelNumberString];
            } else if (extractedLabelNumberString !== null) {
                meaningfulLabel = `Unmapped label number: ${extractedLabelNumberString}`;
            }

            // Format the disease name for display (e.g., replace underscores with spaces)
            const displayDiseaseName = meaningfulLabel.replace(/_/g, ' ').replace(/___/g, ' - ').trim();

            // Set CNN prediction text with a placeholder while GPT-4o works
            predictionTextElement.textContent = `Diagnosing...`; 
            fadeInElement(predictionContainer); // Ensure it's visible

            // Step 2: Call GPT-4o for more info using the identified disease name (no image sent here)
            const gptResponse = await fetch('/get_disease_info', { // New endpoint for disease info
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ disease_name_cnn: displayDiseaseName }) // Pass CNN's identified disease name
            });

            if (!gptResponse.ok) {
                throw new Error(`GPT-4o API error! status: ${gptResponse.status}`);
            }
            const gptResult = await gptResponse.json();

            // Hide loader
            fadeOutElement(loaderContainer);
            
            if (gptResult.success) {
                const diseaseInfoDisplayParagraph = gptResult.disease_info_display; // This is the pre-formatted paragraph
                const openingPhrase = gptResult.opening_phrase; // Get the opening phrase

                // Update CNN prediction text with the friendly phrase from GPT-4o
                predictionTextElement.textContent = openingPhrase;

                // Directly insert the pre-formatted paragraph
                gptOutputText.innerHTML = diseaseInfoDisplayParagraph;
                fadeInElement(diseaseInfoContainer); // Changed from plantInfoContainer

            } else {
                gptOutputText.innerHTML = `<p class="text-danger">Error fetching disease details: ${gptResult.error}</p>`;
                fadeInElement(diseaseInfoContainer); // Changed from plantInfoContainer
                // CNN prediction remains visible for error context
            }
        } catch (error) {
            console.error('Error:', error);
            fadeOutElement(loaderContainer);
            // Ensure prediction container is visible for error message
            predictionTextElement.textContent = `Oops! Something went wrong: ${error.message}`;
            predictionTextElement.style.color = 'red'; 
            fadeInElement(predictionContainer); 
        }
    });
});