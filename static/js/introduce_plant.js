const canvas = document.getElementById('slamMapCanvas');
const ctx = canvas.getContext('2d');
const clickedCoordsDiv = document.getElementById('clickedCoords');
const locationXInput = document.getElementById('location_x');
const locationYInput = document.getElementById('location_y');
const mapMarker = document.getElementById('mapMarker');
const robotId = document.getElementById('robotId').value;
const mapMessageDiv = document.getElementById('mapMessage'); // Changed from noMapMessageDiv
const mapMessageText = document.getElementById('mapMessageText');
const startCalibrationButton = mapMessageDiv.querySelector('.start');


let currentMapMetadata = null;

// Validation state variables
let isLocationSelected = false;
let isPictureUploadedAndIdentified = false;
let isPlantNumberValid = false;

// Elements for plant info display
const plantInfoDisplay = document.getElementById('plantInfoDisplay');
const plantInfoLoading = document.getElementById('plantInfoLoading');
const plantDetailsOutput = document.getElementById('plantDetailsOutput');
const identifiedPlantNameInput = document.getElementById('identifiedPlantName');
const identifiedPlantInfoInput = document.getElementById('identifiedPlantInfo');

// Removed decodeAndDrawPGM as server sends PNG base64 directly

function loadSlamMap() {
    // Initially hide canvas and show loading message
    canvas.style.display = 'none';
    mapMessageDiv.style.display = 'block';
    mapMessageText.textContent = 'Loading map...';
    startCalibrationButton.style.display = 'none'; // Hide button during loading

    fetch(`/get_latest_map/${robotId}`) // Corrected endpoint URL
        .then(response => {
            if (response.status === 404) {
                // Specific handling for "No map found"
                return Promise.reject({ status: 404, message: "No SLAM map found for this robot. Please start calibration." });
            }
            if (!response.ok) {
                // Generic error for other HTTP issues
                return response.json().then(errorData => {
                    const errorMessage = errorData.error || 'Unknown error fetching map.';
                    throw new Error(`Server error (${response.status}): ${errorMessage}`);
                });
            }
            return response.json();
        })
        .then(data => {
            // Check if map_data_pgm_b64 is present and valid
            if (data.map_data_pgm_b64) {
                currentMapMetadata = data.map_metadata; // Store metadata
                const img = new Image();
                img.onload = () => {
                    // Set canvas dimensions based on the image
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);
                    canvas.style.display = 'block'; // Show canvas
                    mapMessageDiv.style.display = 'none'; // Hide message

                    // Enable map click functionality
                    canvas.onclick = function (e) {
                        const rect = canvas.getBoundingClientRect();
                        const pixelX = e.clientX - rect.left;
                        const pixelY = e.clientY - rect.top;

                        // Use metadata from the server for accurate conversion
                        const resolution = currentMapMetadata.resolution;
                        const originX = currentMapMetadata.origin[0];
                        const originY = currentMapMetadata.origin[1];
                        const mapHeightPx = data.height; // Use height from server response

                        // ROS map coordinates (Y-axis inverted for display)
                        const mapX = originX + pixelX * resolution;
                        const mapY = originY + (mapHeightPx - pixelY) * resolution; // Invert Y for ROS convention

                        locationXInput.value = mapX.toFixed(3);
                        locationYInput.value = mapY.toFixed(3);
                        clickedCoordsDiv.textContent = `Selected Location: X: ${mapX.toFixed(2)}, Y: ${mapY.toFixed(2)}`;
                        mapMarker.style.left = `${pixelX}px`;
                        mapMarker.style.top = `${pixelY}px`;
                        mapMarker.style.display = 'block';
                        isLocationSelected = true;
                    };
                    console.log("SLAM map loaded and rendered successfully.");
                };
                img.onerror = (err) => {
                    console.error("Error rendering map image:", err);
                    displayMapError("Failed to render map image. Data might be corrupted.");
                };
                img.src = data.map_data_pgm_b64; // This is already data:image/png;base64
            } else {
                displayMapError("Map data is incomplete or invalid.");
            }
        })
        .catch(error => {
            console.error('Map loading error:', error);
            if (error.status === 404) {
                displayMapError(error.message, true); // Show calibration button for 404
            } else {
                displayMapError(`Error loading map: ${error.message || 'Unknown error'}`);
            }
        });
}

function startCalibration() {
    fetch('/start_calibration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert("Calibration started. Please wait for map data to appear. This may take a moment.");
                // Optionally, you can set a timeout to try loading the map again after some time
                setTimeout(loadSlamMap, 5000); // Try loading map after 5 seconds
            } else {
                alert("Calibration failed: " + (data.error || "Unknown error"));
            }
        })
        .catch(err => {
            console.error("Calibration request failed", err);
            alert("Network error while starting calibration.");
        });
}

// Renamed and refined to display map-specific errors
function displayMapError(message, showCalibrationBtn = false) {
    canvas.style.display = 'none'; // Hide canvas
    mapMessageDiv.style.display = 'block'; // Show message container
    mapMessageText.textContent = message; // Set message text
    if (showCalibrationBtn) {
        startCalibrationButton.style.display = 'block'; // Show calibration button
    } else {
        startCalibrationButton.style.display = 'none'; // Hide calibration button
    }
    // Reset canvas size for consistent message display area
    canvas.width = mapContainer.offsetWidth; // Use container width
    canvas.height = mapContainer.offsetHeight; // Use container height
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear any previous drawings
}

document.addEventListener('DOMContentLoaded', () => {
    loadSlamMap();
});

const steps = document.querySelectorAll(".form-step");
const nextStepButtons = document.querySelectorAll(".next-step-button"); 
const plantNumberInput = document.getElementById('plantNumber');
const submitButton = document.querySelector('button[type="submit"]');

let currentStepIndex = 0;

steps[0].classList.add("active");

nextStepButtons.forEach((button, index) => {
    button.addEventListener("click", (event) => {
        const clickedButtonSectionIndex = Array.from(steps).indexOf(button.closest('.form-step'));
        if (clickedButtonSectionIndex === 0) {
            if (!isLocationSelected) {
                alert("Please select a valid location on the map before proceeding.");
                event.preventDefault();
                return;
            }
        } else if (clickedButtonSectionIndex === 1) {
            if (!isPictureUploadedAndIdentified) {
                alert("Please upload a valid plant picture and wait for identification before proceeding.");
                event.preventDefault();
                return;
            }
        } else if (clickedButtonSectionIndex === 2) {
            plantNumberInput.dispatchEvent(new Event('input')); 
            if (!isPlantNumberValid) {
                alert("Please enter a valid plant number (a positive whole number) before proceeding.");
                event.preventDefault();
                return;
            }
        }

        if (currentStepIndex >= steps.length - 1) {
            if (clickedButtonSectionIndex === steps.length - 1) {
                return;
            }
        }

        const currentStepElement = steps[currentStepIndex];
        currentStepElement.style.opacity = '0';

        const transitionEndHandler = () => {
            currentStepElement.removeEventListener('transitionend', transitionEndHandler);
            currentStepElement.style.display = 'none';
            currentStepElement.classList.remove("active");
            currentStepIndex++;
            if (currentStepIndex < steps.length) {
                const nextStepElement = steps[currentStepIndex];
                nextStepElement.style.display = 'block';
                setTimeout(() => {
                    nextStepElement.style.opacity = '1';
                    nextStepElement.classList.add("active");
                }, 50);
            }
        };

        currentStepElement.addEventListener('transitionend', transitionEndHandler);
    });
});

plantNumberInput.addEventListener('input', function() {
    const value = parseInt(this.value);
    if (isNaN(value) || value <= 0 || !Number.isInteger(value)) {
        isPlantNumberValid = false;
        this.style.borderColor = 'red';
        this.style.boxShadow = '0 0 5px rgba(255, 0, 0, 0.5)';
    } else {
        isPlantNumberValid = true;
        this.style.borderColor = '#ccc';
        this.style.boxShadow = 'none';
    }
});

submitButton.addEventListener('click', function(event) {
    plantNumberInput.dispatchEvent(new Event('input')); 
    if (!isPlantNumberValid) {
        alert("Please enter a valid plant number (a positive whole number) before submitting.");
        event.preventDefault();
    }
});

document.getElementById('customUploadButton').addEventListener('click', function() {
    document.getElementById('plantPictureInput').click();
});

document.getElementById('plantPictureInput').addEventListener('change', async function () {
    const preview = document.getElementById('plantPicturePreview');
    const file = this.files[0];
    plantDetailsOutput.innerHTML = '';
    identifiedPlantNameInput.value = '';
    identifiedPlantInfoInput.value = '';
    isPictureUploadedAndIdentified = false;

    if (file) {
        preview.src = URL.createObjectURL(file);
        preview.style.display = 'block';
        plantInfoLoading.style.display = 'block';

        const reader = new FileReader();
        reader.onload = async function(e) {
            const base64Image = e.target.result.split(',')[1];
            try {
                const response = await fetch('/identify_plant_api', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image_b64: base64Image }) 
                });
                const result = await response.json();
                if (response.ok && result.success) {
                    const commonName = result.plant_name || "Unknown Plant";
                    const plantInfoStructured = result.plant_info_structured || {};
                    let formattedDetails = [];
                    if (plantInfoStructured.genus && plantInfoStructured.genus !== 'Unknown' && plantInfoStructured.genus !== 'Not Specified') {
                        formattedDetails.push(`<strong>Genus:</strong> ${plantInfoStructured.genus}`);
                    }
                    if (plantInfoStructured.family && plantInfoStructured.family !== 'Unknown' && plantInfoStructured.family !== 'Not Specified') {
                        formattedDetails.push(`<strong>Family:</strong> ${plantInfoStructured.family}`);
                    }
                    if (plantInfoStructured.habitat && plantInfoStructured.habitat !== 'Unknown' && plantInfoStructured.habitat !== 'Not Specified') {
                        formattedDetails.push(`<strong>Habitat:</strong> ${plantInfoStructured.habitat}`);
                    }
                    let descriptionHtml = '';
                    if (plantInfoStructured.description && plantInfoStructured.description !== 'No detailed description available.' && plantInfoStructured.description !== 'No description available.') {
                        descriptionHtml = `<div id="plantDescription"><strong>Description:</strong> ${plantInfoStructured.description}</div>`;
                    } else {
                        descriptionHtml = `<div id="plantDescription"><strong>Description:</strong> No detailed description available.</div>`;
                    }
                    plantDetailsOutput.innerHTML = `
                        <p><strong>Common Name:</strong> ${commonName}</p>
                        <p>${formattedDetails.join(' - ')}</p>
                        ${descriptionHtml}
                    `;
                    identifiedPlantNameInput.value = commonName;
                    identifiedPlantInfoInput.value = JSON.stringify(plantInfoStructured);
                    isPictureUploadedAndIdentified = true;
                } else {
                    plantDetailsOutput.innerHTML = `<p style="color: red;">Error: ${result.error || 'Could not identify plant.'}</p>`;
                    isPictureUploadedAndIdentified = false;
                }
            } catch (error) {
                console.error('Error calling identify_plant_api:', error);
                if (error instanceof SyntaxError) {
                    plantDetailsOutput.innerHTML = `<p style="color: red;">Received invalid response from server. Please try again.</p>`;
                } else {
                    plantDetailsOutput.innerHTML = `<p style="color: red;">Network error or server issue during identification.</p>`;
                }
                isPictureUploadedAndIdentified = false;
            } finally {
                plantInfoLoading.style.display = 'none';
            }
        };
        reader.readAsDataURL(file); // Read file as Data URL
    } else {
        preview.src = '#';
        preview.style.display = 'none';
        plantInfoLoading.style.display = 'none';
    }
});

// JS for custom emoji cursor
const customCursor = document.getElementById('customCursor');
const mapCanvasElement = document.getElementById('slamMapCanvas');

// Function to update cursor position
function moveCustomCursor(e) {
    const offsetX = -10; 
    const offsetY = -10; 
    customCursor.style.left = (e.clientX + offsetX) + 'px';
    customCursor.style.top = (e.clientY + offsetY) + 'px';
}

// Hide custom cursor when mouse leaves the map area
mapCanvasElement.addEventListener('mouseleave', () => {
    customCursor.style.display = 'none';
});

// Show and move custom cursor when mouse enters/moves over map area
mapCanvasElement.addEventListener('mouseenter', () => {
    customCursor.style.display = 'block';
});

mapCanvasElement.addEventListener('mousemove', moveCustomCursor);