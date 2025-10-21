const plantNodes = document.querySelectorAll('.plant-node');
    const svg = document.querySelector('.universe-lines');
    const container = document.querySelector('.universe-container');
  
    const centerX = window.innerWidth / 2;
    const centerY = container.offsetHeight / 2;
    const radius = 170;
  
    const angles = [];
  
    plantNodes.forEach((node, i) => {
      const angle = (2 * Math.PI / plantNodes.length) * i - Math.PI / 2;
      angles.push(angle);
  
      const x = centerX + radius * Math.cos(angle) - 65;
      const y = centerY + radius * Math.sin(angle) - 20;
  
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
  
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", centerX);
      line.setAttribute("y1", centerY);
      line.setAttribute("x2", x + 65);
      line.setAttribute("y2", y + 20);
      svg.appendChild(line);
  
      node.addEventListener('mouseenter', () => {
        document.body.classList.add('hovered');
      });
      node.addEventListener('mouseleave', () => {
        document.body.classList.remove('hovered');
      });
    });
  
    // 🌌 Animate each plant-node around the center
    let t = 0;
    function animateOrbit() {
      t += 0.005;
      plantNodes.forEach((node, i) => {
        const a = angles[i] + t;
        const x = centerX + radius * Math.cos(a) - 65;
        const y = centerY + radius * Math.sin(a) - 20;
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
  
        // update lines too
        const line = svg.querySelectorAll('line')[i];
        line.setAttribute("x2", x + 65);
        line.setAttribute("y2", y + 20);
      });
      requestAnimationFrame(animateOrbit);
    }
  
    animateOrbit();