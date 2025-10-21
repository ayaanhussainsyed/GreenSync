function toggleRobotIdInput() {
    var hasRobotYes = document.getElementById('hasRobotYes');
    var robotIdInputGroup = document.getElementById('robotIdInputGroup');
    if (hasRobotYes.checked) {
        robotIdInputGroup.style.display = 'block';
    } else {
        robotIdInputGroup.style.display = 'none';
    }
}

// Initialize state on page load in case of re-rendering after invalid ID
document.addEventListener('DOMContentLoaded', function() {
    toggleRobotIdInput();
});