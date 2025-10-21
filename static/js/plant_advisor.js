const labelMap = {
    '0': 'pink primrose', '1': 'hard-leaved pocket orchid', '2': 'canterbury bells', '3': 'sweet pea', '4': 'english marigold',
    '5': 'tiger lily', '6': 'moon orchid', '7': 'bird of paradise', '8': 'monkshood', '9': 'globe thistle',
    '10': 'snapdragon', '11': 'colt\'s foot', '12': 'king protea', '13': 'spear thistle', '14': 'yellow iris',
    '15': 'globe-flower', '16': 'purple coneflower', '17': 'peruvian lily', '18': 'balloon flower', '19': 'giant white arum lily',
    '20': 'fire lily', '21': 'pincushion flower', '22': 'fritillary', '23': 'red ginger', '24': 'grape hyacinth',
    '25': 'corn poppy', '26': 'prince of wales feathers', '27': 'stemless gentian', '28': 'artichoke', '29': 'sweet william',
    '30': 'carnation', '31': 'garden phlox', '32': 'love in the mist', '33': 'mexican aster', '34': 'alpine sea holly',
    '35': 'ruby-lipped cattleya', '36': 'cape flower', '37': 'great masterwort', '38': 'siam tulip', '39': 'lenten rose',
    '40': 'barbeton daisy', '41': 'daffodil', '42': 'sword lily', '43': 'poinsettia', '44': 'bolero deep blue',
    '45': 'wallflower', '46': 'marigold', '47': 'buttercup', '48': 'oxeye daisy', '49': 'common dandelion',
    '50': 'petunia', '51': 'wild pansy', '52': 'primula', '53': 'sunflower', '54': 'pelargonium', '55': 'bishop of llandaff',
    '56': 'gaura', '57': 'geranium', '58': 'orange dahlia', '59': 'pink-yellow dahlia', '60': 'cautleya spicata',
    '61': 'japanese anemone', '62': 'black-eyed susan', '63': 'silverbush', '64': 'californian poppy', '65': 'osteospermum',
    '66': 'spring crocus', '67': 'bearded iris', '68': 'windflower', '69': 'tree poppy', '70': 'gazania', '71': 'azalea',
    '72': 'water lily', '73': 'rose', '74': 'thorn apple', '75': 'morning glory', '76': 'passion flower', '77': 'lotus',
    '78': 'toad lily', '79': 'anthurium', '80': 'frangipani', '81': 'clematis', '82': 'hibiscus', '83': 'columbine',
    '84': 'desert-rose', '85': 'tree mallow', '86': 'Purple Dyed Dendrobium orchids', '87': 'cyclamen', '88': 'watercress', '89': 'canna lily',
    '90': 'hippeastrum', '91': 'bee balm', '92': 'ball moss', '93': 'foxglove', '94': 'bougainvillea', '95': 'camellia',
    '96': 'Madagascar Periwinkle', '97': 'mexican petunia', '98': 'bromelia', '99': 'blanket flower', '100': 'trumpet creeper', '101': 'blackberry lily'
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
    const plantInfoContainer = document.getElementById('plantInfoContainer');
    const gptOutputText = document.getElementById('gptOutputText'); // Div for GPT output paragraph
    const identifiedPlantNameInput = document.getElementById('identifiedPlantName'); // Hidden input for common name
    const identifiedPlantInfoStructuredInput = document.getElementById('identifiedPlantInfoStructured'); // Hidden input for structured info

    fileInput.addEventListener('change', async function() {
        const file = this.files[0];
        if (!file) {
            console.log("No file selected.");
            return;
        }

        // Hide previous GPT info if any
        fadeOutElement(plantInfoContainer);
        
        // Show loader (it will fade in)
        fadeInElement(loaderContainer, 'flex'); 

        const formData = new FormData();
        formData.append('image', file);

        try {
            // Step 1: Get prediction from CNN model (Flask backend)
            const predictResponse = await fetch('/predict', {
                method: 'POST',
                body: formData
            });

            if (!predictResponse.ok) {
                throw new Error(`HTTP error! status: ${predictResponse.status}`);
            }
            const predictResult = await predictResponse.json();
            const predictionString = predictResult.prediction;

            let meaningfulLabel = 'Unknown Plant';
            let extractedLabelNumberString = null;

            if (predictionString && typeof predictionString === 'string' && predictionString.startsWith('LABEL_')) {
                extractedLabelNumberString = predictionString.replace('LABEL_', '');
            }

            if (extractedLabelNumberString !== null && labelMap.hasOwnProperty(extractedLabelNumberString)) {
                meaningfulLabel = labelMap[extractedLabelNumberString];
            } else if (extractedLabelNumberString !== null) {
                meaningfulLabel = `Unmapped label number: ${extractedLabelNumberString}`;
            }

            const displayLabel = meaningfulLabel.charAt(0).toUpperCase() + meaningfulLabel.slice(1);

            // Set CNN prediction text with a placeholder while GPT-4o works
            predictionTextElement.textContent = `Identifying...`; 
            fadeInElement(predictionContainer); // Ensure it's visible

            // Step 2: Call GPT-4o for more info using the identified plant name (no image sent here)
            const gptResponse = await fetch('/identify_plant_api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ plant_name_cnn: displayLabel }) // Pass CNN's identified name
            });

            if (!gptResponse.ok) {
                throw new Error(`GPT-4o API error! status: ${gptResponse.status}`);
            }
            const gptResult = await gptResponse.json();

            // Hide loader
            fadeOutElement(loaderContainer);
            
            if (gptResult.success) {
                const plantInfoDisplayParagraph = gptResult.plant_info_display; // This is the pre-formatted paragraph
                const plantInfoStructured = gptResult.plant_info_structured; // This is the structured object
                const openingPhrase = gptResult.opening_phrase; // Get the opening phrase

                // Update CNN prediction text with the friendly phrase from GPT-4o
                predictionTextElement.textContent = openingPhrase;

                // Directly insert the pre-formatted paragraph
                gptOutputText.innerHTML = plantInfoDisplayParagraph;
                fadeInElement(plantInfoContainer); 

                // Populate hidden inputs for the next page (Introduce a Leafy Pal)
                identifiedPlantNameInput.value = gptResult.plant_name; // Use the common_name from API response
                identifiedPlantInfoStructuredInput.value = JSON.stringify(plantInfoStructured);

            } else {
                gptOutputText.innerHTML = `<p class="text-danger">Error fetching plant details: ${gptResult.error}</p>`;
                fadeInElement(plantInfoContainer); 
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