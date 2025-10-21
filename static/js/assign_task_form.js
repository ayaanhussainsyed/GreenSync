document.addEventListener('DOMContentLoaded', function () {
    const dropdownToggle = document.getElementById('taskDropdownToggle');
    const dropdownMenu = document.getElementById('taskDropdownMenu');
    const dropdownSelectedText = document.getElementById('dropdownSelectedText');
    const selectedTaskInput = document.getElementById('selectedTask');
    const dropdownItems = dropdownMenu.querySelectorAll('.custom-dropdown-item');

    dropdownToggle.addEventListener('click', function () {
        dropdownMenu.classList.toggle('show');
    });

    dropdownItems.forEach(item => {
        item.addEventListener('click', function () {
            const value = this.getAttribute('data-value');
            dropdownSelectedText.textContent = this.textContent;
            selectedTaskInput.value = value;
            dropdownMenu.classList.remove('show');
            // Add validation styling if needed
            dropdownToggle.classList.remove('is-invalid');
        });
    });

    // Close dropdown if clicked outside
    document.addEventListener('click', function (event) {
        if (!dropdownToggle.contains(event.target) && !dropdownMenu.contains(event.target)) {
            dropdownMenu.classList.remove('show');
        }
    });

    // Form validation for the custom dropdown
    const form = document.querySelector('.needs-validation');
    form.addEventListener('submit', function (event) {
        if (!selectedTaskInput.value) {
            event.preventDefault();
            event.stopPropagation();
            dropdownToggle.classList.add('is-invalid');
        } else {
            dropdownToggle.classList.remove('is-invalid');
        }
        form.classList.add('was-validated');
    }, false);
});