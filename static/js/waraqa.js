const header = document.getElementById('header');
        const chatAreaWrapper = document.querySelector('.chat-area-wrapper');
        const chatContent = document.getElementById('chatContent');
        const chatContainer = document.getElementById('chatContainer');
        const promptInput = document.getElementById('promptInput');
        const sendButton = document.getElementById('sendButton');
        const imageUpload = document.getElementById('imageUpload');
        const imagePreview = document.getElementById('imagePreview');
        const imagePreviewContainer = document.getElementById('imagePreviewContainer');
        const loadingBar = document.getElementById('loadingBar');
        const additionalButtons = document.getElementById('additionalButtons');

        let isFirstPromptInConversation = true;

        // Handle image preview
        imageUpload.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    imagePreview.src = e.target.result;
                    imagePreviewContainer.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                imagePreview.src = '#';
                imagePreviewContainer.style.display = 'none';
            }
        });
        async function sendPrompt() {
        const prompt = promptInput.value.trim();
        if (!prompt && !imageUpload.files[0]) { // Check if both are empty
            alert('Please enter a prompt or upload an image.');
            return;
        }

        // Capture and display user's prompt (if any)
        if (prompt) {
            const userMessageDiv = document.createElement('div');
            userMessageDiv.classList.add('user-message');
            userMessageDiv.textContent = prompt;
            chatContent.appendChild(userMessageDiv);
            setTimeout(() => userMessageDiv.classList.add('visible'), 10);
        }
        
        promptInput.value = ''; // Clear input field
        
        // Animate header out (only once)
        if (header && !header.classList.contains('hidden')) {
            header.classList.add('hidden');
            chatContent.classList.add('shifted');
        }

        // Show loading bar
        loadingBar.style.display = 'block';

        let imageBase64 = null;
        let userImageDisplayDiv = null;

        if (imageUpload.files[0]) {
            const file = imageUpload.files[0];
            const reader = new FileReader();
            reader.readAsDataURL(file);

            userImageDisplayDiv = document.createElement('div');
            userImageDisplayDiv.classList.add('user-message'); // Apply user message styling for consistency
            const imgElement = document.createElement('img');
            imgElement.classList.add('user-uploaded-image');
            userImageDisplayDiv.appendChild(imgElement);
            chatContent.appendChild(userImageDisplayDiv);
            setTimeout(() => userImageDisplayDiv.classList.add('visible'), 10);

            await new Promise(resolve => {
                reader.onloadend = () => {
                    imageBase64 = reader.result.split(',')[1]; // Corrected: imageBase64
                    imgElement.src = reader.result; // Display the uploaded image immediately
                    resolve();
                };
            });
        }

        // Clear image preview and input after processing
        imagePreview.src = '#';
        imagePreviewContainer.style.display = 'none';
        imageUpload.value = '';

        try {
            const response = await fetch('/get_gardening_tips', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: prompt,
                    image: imageBase64,
                    is_first_prompt: isFirstPromptInConversation
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Create and append AI response element
            const aiResponseDiv = document.createElement('div');
            aiResponseDiv.classList.add('ai-response');
            let fullHtmlContent = '';

            if (data.success) {
                // No need for separate DALL-E image if user uploaded one,
                // as the backend now sends the user's uploaded image URL back.
                // The frontend now displays the user's uploaded image immediately.

                // Convert Markdown to HTML
                let markdownHtml = marked.parse(data.response);

                // Replace Markdown headings with custom HTML tags for styling
                markdownHtml = markdownHtml.replace(/<h2 id="(.*?)">(.*?)<\/h2>/g, '<h2 id="$1">$2</h2>');
                markdownHtml = markdownHtml.replace(/<h3 id="(.*?)">(.*?)<\/h3>/g, '<h3 id="$1">$2</h3>');

                // Add checkboxes only to list items explicitly marked as task lists in markdown ([ ] or [x])
                markdownHtml = markdownHtml.replace(/<li>(\s*\[[ xX]?\]\s*)(.*?)(<\/li>)/g, (match, checkboxPrefix, content, closingLi) => {
                    const isChecked = checkboxPrefix.toLowerCase().includes('[x]');
                    const checkedAttribute = isChecked ? 'checked' : '';
                    const completedClass = isChecked ? ' completed' : '';
                    return `<li class="task-list-item${completedClass}"><input type="checkbox" class="task-checkbox" id="task-${Date.now()}-${Math.random().toString(36).substring(7)}"${checkedAttribute}><label for="task-${Date.now()}-${Math.random().toString(36).substring(7)}">${content}</label>${closingLi}`;
                });

                fullHtmlContent += markdownHtml;

            } else {
                fullHtmlContent = `<p class="text-danger">Error: ${data.error}</p>`;
            }

            aiResponseDiv.innerHTML = fullHtmlContent;
            chatContent.appendChild(aiResponseDiv);

            // Animate AI message in
            setTimeout(() => aiResponseDiv.classList.add('visible'), 10);

            // Add event listeners for checkboxes in the newly added AI response
            aiResponseDiv.querySelectorAll('.task-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', function() {
                    if (this.checked) {
                        this.closest('li').classList.add('completed');
                    } else {
                        this.closest('li').classList.remove('completed');
                    }
                });
            });

            // After the first successful response, set the flag to false
            isFirstPromptInConversation = false;

            // Scroll to the bottom to show new content
            chatContent.scrollTop = chatContent.scrollHeight;

        } catch (error) {
            console.error('Fetch error:', error);
            const errorDiv = document.createElement('div');
            errorDiv.classList.add('ai-response'); // Use AI response class for styling
            errorDiv.innerHTML = `<p class="text-danger">Failed to get gardening tips. Please try again later.</p>`;
            chatContent.appendChild(errorDiv);
            setTimeout(() => errorDiv.classList.add('visible'), 10);
            chatContent.scrollTop = chatContent.scrollHeight;
        } finally {
            // Hide loading bar
            loadingBar.style.display = 'none';
        }
    }
        // async function sendPrompt() {
        //     const prompt = promptInput.value.trim();
        //     if (!prompt) {
        //         alert('Please enter a prompt.');
        //         return;
        //     }

        //     // Capture and display user's prompt
        //     const userMessageDiv = document.createElement('div'); // Create a new div for the user message
        //     userMessageDiv.classList.add('user-message');
        //     userMessageDiv.textContent = prompt;
        //     chatContent.appendChild(userMessageDiv); // Append it to the chat content

        //     // Animate user message in
        //     setTimeout(() => userMessageDiv.classList.add('visible'), 10);

        //     promptInput.value = ''; // Clear input field
        //     imagePreview.src = '#'; // Clear image preview
        //     imagePreviewContainer.style.display = 'none';
        //     imageUpload.value = ''; // Clear file input

        //     // Animate header out (only once)
        //     if (header && !header.classList.contains('hidden')) {
        //         header.classList.add('hidden');
        //         chatContent.classList.add('shifted');
        //     }

        //     // Show loading bar
        //     loadingBar.style.display = 'block';

        //     let imageBase64 = null;
        //     if (imageUpload.files[0]) {
        //         const file = imageUpload.files[0];
        //         const reader = new FileReader();
        //         reader.readAsDataURL(file);
        //         await new Promise(resolve => { // Use a Promise to wait for FileReader to complete
        //             reader.onloadend = () => {
        //                 imageBase64 = reader.result.split(',')[1]; // Get base64 string without data:image/jpeg;base64, prefix
        //                 resolve();
        //             };
        //         });
        //     }

        //     try {
        //         const response = await fetch('/get_gardening_tips', {
        //             method: 'POST',
        //             headers: {
        //                 'Content-Type': 'application/json', // <--- This is the crucial change
        //             },
        //             body: JSON.stringify({ // <--- Send as JSON
        //                 prompt: prompt,
        //                 image: imageBase64, // Send base64 string
        //                 is_first_prompt: isFirstPromptInConversation // Send the flag
        //             })
        //         });

        //         if (!response.ok) {
        //             throw new Error(`HTTP error! status: ${response.status}`);
        //         }

        //         const data = await response.json();

        //         // Create and append AI response element
        //         const aiResponseDiv = document.createElement('div');
        //         aiResponseDiv.classList.add('ai-response');
        //         let fullHtmlContent = '';

        //         if (data.success) {
        //             // Add DALL-E image if available and it's the first prompt
        //             if (data.image_url && isFirstPromptInConversation) {
        //                 fullHtmlContent += `<img src="${data.image_url}" alt="AI Generated Image" class="ai-generated-image">`;
        //             }

        //             // Convert Markdown to HTML
        //             let markdownHtml = marked.parse(data.response);

        //             // Replace Markdown headings with custom HTML tags for styling
        //             markdownHtml = markdownHtml.replace(/<h2 id="(.*?)">(.*?)<\/h2>/g, '<h2 id="$1">$2</h2>');
        //             markdownHtml = markdownHtml.replace(/<h3 id="(.*?)">(.*?)<\/h3>/g, '<h3 id="$1">$2</h3>');

        //             // Add checkboxes only to list items explicitly marked as task lists in markdown ([ ] or [x])
        //             markdownHtml = markdownHtml.replace(/<li>(\s*\[[ xX]?\]\s*)(.*?)(<\/li>)/g, (match, checkboxPrefix, content, closingLi) => {
        //                 const isChecked = checkboxPrefix.toLowerCase().includes('[x]');
        //                 const checkedAttribute = isChecked ? 'checked' : '';
        //                 const completedClass = isChecked ? ' completed' : '';
        //                 return `<li class="task-list-item${completedClass}"><input type="checkbox" class="task-checkbox" id="task-${Date.now()}-${Math.random().toString(36).substring(7)}"${checkedAttribute}><label for="task-${Date.now()}-${Math.random().toString(36).substring(7)}">${content}</label>${closingLi}`;
        //             });

        //             fullHtmlContent += markdownHtml;

        //         } else {
        //             fullHtmlContent = `<p class="text-danger">Error: ${data.error}</p>`;
        //         }

        //         aiResponseDiv.innerHTML = fullHtmlContent;
        //         chatContent.appendChild(aiResponseDiv);

        //         // Animate AI message in
        //         setTimeout(() => aiResponseDiv.classList.add('visible'), 10);

        //         // Add event listeners for checkboxes in the newly added AI response
        //         aiResponseDiv.querySelectorAll('.task-checkbox').forEach(checkbox => {
        //             checkbox.addEventListener('change', function() {
        //                 if (this.checked) {
        //                     this.closest('li').classList.add('completed');
        //                 } else {
        //                     this.closest('li').classList.remove('completed');
        //                 }
        //             });
        //         });

        //         // After the first successful response, set the flag to false
        //         isFirstPromptInConversation = false;

        //         // Scroll to the bottom to show new content
        //         chatContent.scrollTop = chatContent.scrollHeight;

        //     } catch (error) {
        //         console.error('Fetch error:', error);
        //         const errorDiv = document.createElement('div');
        //         errorDiv.classList.add('ai-response'); // Use AI response class for styling
        //         errorDiv.innerHTML = `<p class="text-danger">Failed to get gardening tips. Please try again later.</p>`;
        //         chatContent.appendChild(errorDiv);
        //         setTimeout(() => errorDiv.classList.add('visible'), 10);
        //         chatContent.scrollTop = chatContent.scrollHeight;
        //     } finally {
        //         // Hide loading bar
        //         loadingBar.style.display = 'none';
        //     }
        // }

        // async function sendPrompt() {
        //     const prompt = promptInput.value.trim();
        //     if (!prompt) {
        //         alert('Please enter a prompt.');
        //         return;
        //     }

        //     // Create and append user message element
        //     const userMessageDiv = document.createElement('div');
        //     userMessageDiv.classList.add('user-message');
        //     userMessageDiv.textContent = prompt;
        //     chatContent.appendChild(userMessageDiv);

        //     // Animate user message in
        //     setTimeout(() => userMessageDiv.classList.add('visible'), 10);

        //     promptInput.value = ''; // Clear input field
        //     imagePreview.src = '#'; // Clear image preview
        //     imagePreviewContainer.style.display = 'none';
        //     imageUpload.value = ''; // Clear file input

        //     // Animate header out (only once)
        //     if (header && !header.classList.contains('hidden')) {
        //         header.classList.add('hidden');
        //         chatContent.classList.add('shifted');
        //     }

        //     // Show loading bar
        //     loadingBar.style.display = 'block';

        //     const formData = new FormData();
        //     formData.append('prompt', prompt);
        //     if (imageUpload.files[0]) {
        //         formData.append('image', imageUpload.files[0]);
        //     }
        //     formData.append('is_first_prompt', isFirstPromptInConversation);

        //     try {
        //         const response = await fetch('/get_gardening_tips', {
        //             method: 'POST',
        //             body: formData
        //         });

        //         if (!response.ok) {
        //             throw new Error(`HTTP error! status: ${response.status}`);
        //         }

        //         const data = await response.json();

        //         // Create and append AI response element
        //         const aiResponseDiv = document.createElement('div');
        //         aiResponseDiv.classList.add('ai-response');
        //         let fullHtmlContent = '';

        //         if (data.success) {
        //             // Add DALL-E image if available and it's the first prompt
        //             if (data.image_url && isFirstPromptInConversation) {
        //                 fullHtmlContent += `<img src="${data.image_url}" alt="AI Generated Image" class="ai-generated-image">`;
        //             }

        //             // Convert Markdown to HTML
        //             let markdownHtml = marked.parse(data.response);

        //             // Replace Markdown headings with custom HTML tags for styling
        //             markdownHtml = markdownHtml.replace(/<h2 id="(.*?)">(.*?)<\/h2>/g, '<h2 id="$1">$2</h2>');
        //             markdownHtml = markdownHtml.replace(/<h3 id="(.*?)">(.*?)<\/h3>/g, '<h3 id="$1">$2</h3>');

        //             // Add checkboxes only to list items explicitly marked as task lists in markdown ([ ] or [x])
        //             // This regex looks for <li> tags that contain an opening square bracket followed by a space or 'x' or 'X', then a closing square bracket
        //             markdownHtml = markdownHtml.replace(/<li>(\s*\[[ xX]?\]\s*)(.*?)(<\/li>)/g, (match, checkboxPrefix, content, closingLi) => {
        //                 const isChecked = checkboxPrefix.toLowerCase().includes('[x]');
        //                 const checkedAttribute = isChecked ? 'checked' : '';
        //                 const completedClass = isChecked ? ' completed' : ''; // Add 'completed' class if checked
        //                 return `<li class="task-list-item${completedClass}"><input type="checkbox" class="task-checkbox" id="task-${Date.now()}-${Math.random().toString(36).substring(7)}"${checkedAttribute}><label for="task-${Date.now()}-${Math.random().toString(36).substring(7)}">${content}</label>${closingLi}`;
        //             });


        //             fullHtmlContent += markdownHtml;

        //         } else {
        //             fullHtmlContent = `<p class="text-danger">Error: ${data.error}</p>`;
        //         }

        //         aiResponseDiv.innerHTML = fullHtmlContent;
        //         chatContent.appendChild(aiResponseDiv);

        //         // Animate AI message in
        //         setTimeout(() => aiResponseDiv.classList.add('visible'), 10);

        //         // Add event listeners for checkboxes in the newly added AI response
        //         aiResponseDiv.querySelectorAll('.task-checkbox').forEach(checkbox => {
        //             checkbox.addEventListener('change', function() {
        //                 if (this.checked) {
        //                     this.closest('li').classList.add('completed');
        //                 } else {
        //                     this.closest('li').classList.remove('completed');
        //                 }
        //             });
        //         });

        //         // After the first successful response, set the flag to false
        //         isFirstPromptInConversation = false;

        //         // Scroll to the bottom to show new content
        //         chatContent.scrollTop = chatContent.scrollHeight;

        //     } catch (error) {
        //         console.error('Fetch error:', error);
        //         const errorDiv = document.createElement('div');
        //         errorDiv.classList.add('ai-response'); // Use AI response class for styling
        //         errorDiv.innerHTML = `<p class="text-danger">Failed to get gardening tips. Please try again later.</p>`;
        //         chatContent.appendChild(errorDiv);
        //         setTimeout(() => errorDiv.classList.add('visible'), 10);
        //         chatContent.scrollTop = chatContent.scrollHeight;
        //     } finally {
        //         // Hide loading bar
        //         loadingBar.style.display = 'none';
        //     }
        // }

        sendButton.addEventListener('click', sendPrompt);

        promptInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                sendPrompt();
            }
        });

        // Optional: Implement functionality for additional buttons to pre-fill prompt or send specific queries
        additionalButtons.querySelectorAll('.button').forEach(button => {
            button.addEventListener('click', function() {
                promptInput.value = `Tell me about ${this.textContent.toLowerCase()}`;
                sendPrompt();
            });
        });

        // Set the active link for "GreenBrain"
        document.addEventListener('DOMContentLoaded', () => {
            const navLinks = document.querySelectorAll('.nav-link');
            navLinks.forEach(link => {
                link.classList.remove('active');
            });
            document.querySelector('.nav-link[href="/gardening-tips"]').classList.add('active');
        });
        async function getGardeningTips(prompt, imageData) {
            const data = {};
            if (prompt) data.prompt = prompt;
            if (imageData) data.image = imageData;
            data.is_first_prompt = !localStorage.getItem('chat_history');

            try {
                const response = await fetch('/get_gardening_tips', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (!response.ok || !result.success) {
                    throw new Error(result.error || 'Unknown error');
                }
                document.getElementById('tipResponse').innerText = result.response || 'No response available.';
                if (result.image_url) {
                    document.getElementById('tipImage').src = result.image_url;
                    document.getElementById('tipImage').style.display = 'block';
                } else {
                    document.getElementById('tipImage').style.display = 'none';
                }
                localStorage.setItem('chat_history', JSON.stringify({ history: [] }));
            } catch (error) {
                console.error('Error:', error);
                document.getElementById('tipResponse').innerText = `Failed to get gardening tips. Please try again later. Error: ${error.message}`;
            }
        }
        async function getGardeningTips(prompt, imageData) {
            const data = {};
            if (prompt) data.prompt = prompt;
            if (imageData) data.image = imageData;
            data.is_first_prompt = !localStorage.getItem('chat_history');

            try {
                const response = await fetch('/get_gardening_tips', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify(data)
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
                }
                const result = await response.json();
                if (!result.success) {
                    throw new Error(result.error || 'API error');
                }
                const tipResponse = document.getElementById('tipResponse');
                const tipImage = document.getElementById('tipImage');
                if (tipResponse) tipResponse.innerText = result.response || 'No response available.';
                if (tipImage) {
                    if (result.image_url) {
                        tipImage.src = result.image_url;
                        tipImage.style.display = 'block';
                    } else {
                        tipImage.style.display = 'none';
                    }
                }
                localStorage.setItem('chat_history', JSON.stringify({ history: [] }));
                console.log('Response received:', result);
            } catch (error) {
                console.error('Fetch error:', error);
                const tipResponse = document.getElementById('tipResponse');
                if (tipResponse) tipResponse.innerText = `Failed to get gardening tips. Please try again later. Error: ${error.message}`;
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            const uploadInput = document.getElementById('imageUpload');
            const promptInput = document.getElementById('promptInput');
            const submitBtn = document.getElementById('submitTip');

            if (!uploadInput || !promptInput || !submitBtn || !document.getElementById('tipResponse') || !document.getElementById('tipImage')) {
                console.error('Required elements not found:', { uploadInput, promptInput, submitBtn, tipResponse: document.getElementById('tipResponse'), tipImage: document.getElementById('tipImage') });
                const tipResponse = document.getElementById('tipResponse');
                if (tipResponse) tipResponse.innerText = 'Error: Page elements missing. Please refresh.';
                return;
            }

            uploadInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const base64String = event.target.result.split(',')[1];
                        getGardeningTips(promptInput.value, base64String);
                    };
                    reader.readAsDataURL(file);
                }
            });

            submitBtn.addEventListener('click', () => {
                const file = uploadInput.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const base64String = event.target.result.split(',')[1];
                        getGardeningTips(promptInput.value, base64String);
                    };
                    reader.readAsDataURL(file);
                } else {
                    getGardeningTips(promptInput.value, null);
                }
            });
        });

        // document.addEventListener('DOMContentLoaded', () => {
        //     const uploadInput = document.getElementById('imageUpload');
        //     const promptInput = document.getElementById('promptInput');
        //     const submitBtn = document.getElementById('submitTip');

        //     uploadInput.addEventListener('change', (e) => {
        //         const file = e.target.files[0];
        //         if (file) {
        //             const reader = new FileReader();
        //             reader.onload = (event) => {
        //                 const base64String = event.target.result.split(',')[1];
        //                 getGardeningTips(promptInput.value, base64String);
        //             };
        //             reader.readAsDataURL(file);
        //         }
        //     });

        //     submitBtn.addEventListener('click', () => {
        //         getGardeningTips(promptInput.value, uploadInput.files.length ? uploadInput.files[0] : null);
        //     });
        // });