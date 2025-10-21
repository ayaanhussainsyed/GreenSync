document.addEventListener('DOMContentLoaded', function() {
    const steps = [
        document.getElementById('stepOne'),
        document.getElementById('stepTwo_Watering'),
        document.getElementById('stepTwo_Light'),
        document.getElementById('stepTwo_PestDisease'),
        document.getElementById('stepThree')
    ];

    // Define background colors for each step
    const backgroundColors = [
        '#F0E58B', // Step 1
        '#6CB4EE', // Step 2 (Watering)
        '#CC5500', // Step 3 (Light)
        '#F3E5AB', // Step 4 (Pest/Disease)
        '#FFFFFF'  // Step 5 (Upload)
    ];

    const nextStepButtons = document.querySelectorAll(".next-step-button");
    const plantSelect = document.getElementById('plantSelect');
    const manualPlantNameInput = document.getElementById('manualPlantName');
    const plantNameManualInputDiv = document.getElementById('plantNameManualInput');
    const plantPictureInput = document.getElementById('plantPictureInput');
    const plantPicturePreview = document.getElementById('plantPicturePreview');
    const customUploadButton = document.getElementById('customUploadButton');
    const autopsyForm = document.getElementById('autopsyForm');
    const autopsyLoading = document.getElementById('autopsyLoading');
    const autopsyResultDiv = document.getElementById('autopsyResult');
    const autopsyCauseParagraph = document.getElementById('autopsyCause');
    const semanticMapContainer = document.getElementById('semanticMapContainer');
    const semanticMapSVG = document.getElementById('semanticMapSVG');
    const selectedPlantIdInput = document.getElementById('selectedPlantId');
    const plantSelectionMessage = document.getElementById('plantSelectionMessage');

    const hasPestDiseaseSelect = document.getElementById('hasPestDisease');
    const diseaseDetailsInputDiv = document.getElementById('diseaseDetailsInput');
    const diseaseNameInput = document.getElementById('diseaseName');

    let currentStepIndex = 0;
    steps[0].classList.add("active");
    document.body.style.backgroundColor = backgroundColors[0]; // Set initial background color

    // Function to validate current step before proceeding
    function validateStep(stepIndex) {
        if (stepIndex === 0) { // Step 1: Plant Selection
            const selectedValue = plantSelect.value;
            if (selectedValue === "") {
                // Use a custom message box instead of alert
                displayMessageBox("Please select a plant or choose 'Not added to GreenSync'.");
                return false;
            }
            if (selectedValue === "not_added" && manualPlantNameInput.value.trim() === "") {
                displayMessageBox("Please enter the plant's name if it's not added to GreenSync.");
                manualPlantNameInput.focus();
                return false;
            }
            if (selectedValue !== "not_added") {
                selectedPlantIdInput.value = selectedValue;
            } else {
                selectedPlantIdInput.value = "not_added_:" + manualPlantNameInput.value.trim();
            }
        } else if (steps[stepIndex].id === 'stepTwo_Watering') {
            if (document.getElementById('wateringHistory').value === "") {
                displayMessageBox("Please select a watering frequency.");
                return false;
            }
        } else if (steps[stepIndex].id === 'stepTwo_Light') {
            if (document.getElementById('lightExposure').value === "") {
                displayMessageBox("Please select a light exposure.");
                return false;
            }
        } else if (steps[stepIndex].id === 'stepTwo_PestDisease') {
            const hasDisease = hasPestDiseaseSelect.value;
            if (hasDisease === "") {
                displayMessageBox("Please specify if the plant was diseased in the past.");
                return false;
            }
            if (hasDisease === "yes" && diseaseNameInput.value.trim() === "") {
                displayMessageBox("Please enter the name of the disease or pest.");
                diseaseNameInput.focus();
                return false;
            }
        } else if (stepIndex === steps.length - 1) { // Last Step: Picture Upload
            if (!plantPictureInput.files.length) {
                displayMessageBox("Please upload a picture of the plant.");
                return false;
            }
        }
        return true;
    }

    // Custom message box function
    function displayMessageBox(message) {
        const messageBox = document.createElement('div');
        messageBox.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            z-index: 1000;
            font-family: 'Inter', sans-serif;
            text-align: center;
            max-width: 80%;
        `;
        messageBox.innerHTML = `
            <p>${message}</p>
            <button style="background-color: #4CBB17; color: black; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; margin-top: 10px;">OK</button>
        `;
        document.body.appendChild(messageBox);

        messageBox.querySelector('button').addEventListener('click', () => {
            document.body.removeChild(messageBox);
        });
    }


    // Step transition logic
    nextStepButtons.forEach((button) => {
        button.addEventListener("click", (event) => {
            if (!validateStep(currentStepIndex)) {
                event.preventDefault();
                return;
            }

            const currentStepElement = steps[currentStepIndex];
            currentStepElement.style.opacity = '0'; // Start fading out current step

            // After current step fades out, hide it and show next step
            const transitionEndHandler = () => {
                currentStepElement.removeEventListener('transitionend', transitionEndHandler);
                currentStepElement.style.display = 'none';
                currentStepElement.classList.remove("active");
                
                currentStepIndex++;
                if (currentStepIndex < steps.length) {
                    const nextStepElement = steps[currentStepIndex];
                    nextStepElement.style.display = 'block'; // Make next step visible (but still transparent)
                    
                    // Change background color smoothly
                    document.body.style.backgroundColor = backgroundColors[currentStepIndex];

                    setTimeout(() => {
                        nextStepElement.style.opacity = '1'; // Fade in next step
                        nextStepElement.classList.add("active");
                    }, 50); // Small delay to ensure display:block applies before opacity transition
                }
            };
            currentStepElement.addEventListener('transitionend', transitionEndHandler);
        });
    });

    // Handle "Not added to GreenSync" option and dynamic message
    plantSelect.addEventListener('change', function() {
        const selectedOption = this.options[this.selectedIndex];
        const selectedValue = this.value;

        if (selectedValue === 'not_added') {
            plantNameManualInputDiv.style.display = 'block';
            manualPlantNameInput.setAttribute('required', 'required');
            plantSelectionMessage.textContent = ''; // Clear message for manual input
        } else if (selectedValue === "") { // If "Choose" is selected
            plantNameManualInputDiv.style.display = 'none';
            manualPlantNameInput.removeAttribute('required');
            manualPlantNameInput.value = '';
            plantSelectionMessage.textContent = ''; // Keep empty
        } else {
            plantNameManualInputDiv.style.display = 'none';
            manualPlantNameInput.removeAttribute('required');
            manualPlantNameInput.value = ''; // Clear manual input if not needed
            
            const plantName = selectedOption.dataset.plantName;
            plantSelectionMessage.innerHTML = `Plant Selected, <span style="color: #198753; font-weight: normal;">${plantName}</span>`; // Display message with color
        }
    });
    
    // Handle initial state of the message when page loads
    if (plantSelect.value !== "" && plantSelect.value !== "not_added") {
        const selectedOption = plantSelect.options[plantSelect.selectedIndex];
        const plantName = selectedOption.dataset.plantName;
        plantSelectionMessage.innerHTML = `Plant Selected, <span style="color: #198753; font-weight: normal;">${plantName}</span>`;
    } else {
        plantSelectionMessage.textContent = '';
    }


    // Handle Pest/Disease dropdown
    hasPestDiseaseSelect.addEventListener('change', function() {
        if (this.value === 'yes') {
            diseaseDetailsInputDiv.style.display = 'block';
            diseaseNameInput.setAttribute('required', 'required');
        } else {
            diseaseDetailsInputDiv.style.display = 'none';
            diseaseNameInput.removeAttribute('required');
            diseaseNameInput.value = ''; // Clear input if not needed
        }
    });

    // Custom upload button click
    customUploadButton.addEventListener('click', function() {
        plantPictureInput.click();
    });

    // Image preview logic
    plantPictureInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            plantPicturePreview.src = URL.createObjectURL(file);
            plantPicturePreview.style.display = 'block';
            autopsyResultDiv.style.display = 'none'; // Hide previous result
            autopsyCauseParagraph.textContent = ''; // Clear previous text
            semanticMapContainer.style.display = 'none'; // Hide previous map
            d3.select(semanticMapSVG).selectAll("*").remove(); // Clear SVG content
        } else {
            plantPicturePreview.src = '#';
            plantPicturePreview.style.display = 'none';
        }
    });

    // Function to render the semantic map using D3.js
    function renderSemanticMap(semanticMapData) {
        if (!semanticMapData || !semanticMapData.cause || !semanticMapData.conditions) {
            console.error("Invalid semantic map data:", semanticMapData);
            semanticMapContainer.style.display = 'none';
            return;
        }

        semanticMapContainer.style.display = 'block';
        d3.select(semanticMapSVG).selectAll("*").remove(); // Clear previous SVG content

        const width = semanticMapSVG.clientWidth || 600;
        const height = 400; // Fixed height for the map

        const svg = d3.select(semanticMapSVG)
            .attr("width", width)
            .attr("height", height);

        // Create a group for all content that will be zoomed/panned
        const g = svg.append("g");

        // Define nodes for the hierarchy
        const nodesData = [
            { id: "root_causes", name: "Causes", type: "root" },
            { id: "primary_cause", name: semanticMapData.cause, type: "primary" }
        ];

        semanticMapData.conditions.forEach((condition, index) => {
            nodesData.push({ id: `condition_${index}`, name: condition, type: "condition" });
        });

        // Define links for the hierarchy
        const linksData = [
            { source: "root_causes", target: "primary_cause" }
        ];

        nodesData.filter(d => d.type === "condition").forEach(conditionNode => {
            linksData.push({ source: "primary_cause", target: conditionNode.id });
        });

        // Create a temporary SVG element to measure text dimensions
        const tempSvg = d3.select("body").append("svg")
            .attr("class", "temp-svg")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("pointer-events", "none");

        // Calculate required radius for each node based on text content
        nodesData.forEach(d => {
            const textElement = tempSvg.append("text")
                .attr("font-family", "Inter, sans-serif")
                .attr("font-size", () => {
                    if (d.type === 'root') return '16px';
                    if (d.type === 'primary') return '14px';
                    return '12px';
                })
                .text(d.name);

            const bbox = textElement.node().getBBox();
            // Add padding to text dimensions
            const padding = 20; // Adjust padding as needed
            d.calculatedRadius = Math.max(bbox.width / 2, bbox.height / 2) + padding;
            textElement.remove(); // Clean up temporary text element
        });

        tempSvg.remove(); // Clean up temporary SVG

        // Create a force simulation
        const simulation = d3.forceSimulation(nodesData)
            .force("link", d3.forceLink(linksData).id(d => d.id).distance(d => {
                // Adjust link distance based on node sizes
                const sourceNode = nodesData.find(node => node.id === d.source.id);
                const targetNode = nodesData.find(node => node.id === d.target.id);
                return sourceNode.calculatedRadius + targetNode.calculatedRadius + 50; // Add fixed spacing
            }))
            .force("charge", d3.forceManyBody().strength(-500)) // Stronger repulsion
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide(d => d.calculatedRadius + 5)); // Adjust collision radius based on dynamic radius + padding

        // Add links to the 'g' element
        const link = g.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(linksData)
            .enter().append("line")
            .attr("class", "link")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.6)
            .attr("stroke-width", 2);

        // Add nodes to the 'g' element
        const node = g.append("g")
            .attr("class", "nodes")
            .selectAll("g")
            .data(nodesData)
            .enter().append("g")
            .attr("class", "node")
            .call(d3.drag() // Make nodes draggable
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

        node.append("circle")
            .attr("class", "node-circle")
            .attr("r", d => d.calculatedRadius) // Use calculated radius
            .attr("fill", d => {
                if (d.type === 'root') return '#2d3748'; // Dark for "Causes"
                if (d.type === 'primary') return '#FF6347'; // Red for primary cause
                return '#4CBB17'; // Green for conditions
            })
            .attr("stroke", d => {
                if (d.type === 'root') return '#1a202c';
                if (d.type === 'primary') return '#ff0000';
                return '#333';
            });

        node.append("text")
            .attr("class", "node-text")
            .text(d => d.name)
            .attr("fill", "#FFFFFF") // White text color
            .attr("font-weight", d => {
                if (d.type === 'root' || d.type === 'primary') return 'bold';
                return 'normal';
            })
            .attr("font-size", d => {
                if (d.type === 'root') return '16px';
                if (d.type === 'primary') return '14px';
                return '12px';
            })
            .attr("dy", ".35em")
            .call(wrapText, d => d.calculatedRadius * 1.8); // Pass a width based on calculated radius for wrapping

        // Update positions on each tick
        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node
                .attr("transform", d => `translate(${d.x},${d.y})`);
        });

        // Drag functions
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event, d) {
            // Do NOT set d.fx = null and d.fy = null here.
            // This ensures the node stays in its new position after being dragged.
            if (!event.active) simulation.alphaTarget(0);
        }

        // Zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.5, 3]) // Allow zooming from 0.5x to 3x
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            });

        svg.call(zoom); // Apply zoom to the SVG

        // Function to wrap text
        function wrapText(text, maxWidth) {
            text.each(function() {
                const text = d3.select(this);
                const words = text.text().split(/\s+/).reverse();
                let word;
                let line = [];
                let lineNumber = 0;
                const lineHeight = 1.1; // ems
                const y = text.attr("y");
                const dy = parseFloat(text.attr("dy"));
                let tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");

                while (word = words.pop()) {
                    line.push(word);
                    tspan.text(line.join(" "));
                    if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
                        line.pop();
                        tspan.text(line.join(" "));
                        line = [word];
                        tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
                    }
                }
            });
        }
    }


    // Form submission logic
    autopsyForm.addEventListener('submit', async function(event) {
        event.preventDefault(); // Prevent default form submission

        if (!validateStep(currentStepIndex)) { // Final validation for the last step
            return;
        }

        autopsyLoading.style.display = 'block'; // Show loading spinner
        autopsyResultDiv.style.display = 'none'; // Hide previous result
        semanticMapContainer.style.display = 'none'; // Hide previous map
        d3.select(semanticMapSVG).selectAll("*").remove(); // Clear SVG content

        const plantImageFile = plantPictureInput.files[0];
        let base64Image = null;

        if (plantImageFile) {
            const reader = new FileReader();
            reader.readAsDataURL(plantImageFile);
            await new Promise(resolve => {
                reader.onloadend = () => {
                    base64Image = reader.result.split(',')[1]; // Get base64 string without data URL prefix
                    resolve();
                };
            });
        }

        // Construct data to send to Flask - ensure all care history fields are collected
        const dataToSend = {
            selected_plant_id: selectedPlantIdInput.value,
            watering_history: document.getElementById('wateringHistory').value,
            light_exposure: document.getElementById('lightExposure').value,
            has_pest_disease: hasPestDiseaseSelect.value,
            disease_name: diseaseNameInput.value, // Will be empty if has_pest_disease is 'no'
            plant_picture_b64: base64Image // Send base64 image string
        };

        try {
            const response = await fetch('/perform_autopsy', { // You'll create this endpoint in app.py
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dataToSend)
            });

            const result = await response.json();

            autopsyLoading.style.display = 'none'; // Hide loading spinner

            if (response.ok && result.success) {
                autopsyCauseParagraph.innerHTML = result.autopsy_report; // Use innerHTML for rich text
                autopsyResultDiv.style.display = 'block';
                autopsyResultDiv.style.backgroundColor = '#e6ffe6'; /* Light green for success */
                autopsyResultDiv.style.borderColor = '#4CBB17'; /* Green border */

                // Render semantic map
                if (result.semantic_map) {
                    renderSemanticMap(result.semantic_map);
                }
            } else {
                autopsyCauseParagraph.textContent = result.error || 'Failed to perform autopsy. Please try again.';
                autopsyResultDiv.style.display = 'block';
                autopsyResultDiv.style.backgroundColor = '#ffe6e6'; /* Light red for error */
                autopsyResultDiv.style.borderColor = '#ff0000'; /* Red border */
                semanticMapContainer.style.display = 'none'; // Hide map on error
            }
        } catch (error) {
            console.error('Error during autopsy submission:', error);
            autopsyLoading.style.display = 'none';
            autopsyResultDiv.style.display = 'block';
            autopsyCauseParagraph.textContent = 'Network error or server issue. Please try again.';
            autopsyResultDiv.style.backgroundColor = '#ffe6e6'; /* Light red for error */
            autopsyResultDiv.style.borderColor = '#ff0000'; /* Red border */
            semanticMapContainer.style.display = 'none'; // Hide map on error
        }
    });
});