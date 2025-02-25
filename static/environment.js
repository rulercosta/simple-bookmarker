function isPWA() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone ||
           document.referrer.includes('android-app://');
}

function setupEnvironment() {
    const appContainer = document.getElementById('app-container');
    const readmeContainer = document.getElementById('readme-container');
    const appStyles = document.getElementById('app-styles');

    if (isPWA()) {
        if (readmeContainer) readmeContainer.style.display = 'none';
        if (appContainer) appContainer.style.display = 'block';
        if (appStyles) appStyles.disabled = false;
    } else {
        if (appContainer) appContainer.style.display = 'none';
        if (appStyles) appStyles.disabled = true;
        
        fetch('README.md')
            .then(response => response.text())
            .then(markdown => {
                if (readmeContainer && window.marked) {
                    readmeContainer.style.display = 'block';
                    readmeContainer.style.padding = '20px';
                    readmeContainer.style.maxWidth = '800px';
                    readmeContainer.style.margin = '0 auto';
                    readmeContainer.innerHTML = marked.parse(markdown);
                }
            })
            .catch(console.error);
    }
}

window.addEventListener('load', setupEnvironment);
window.matchMedia('(display-mode: standalone)').addEventListener('change', setupEnvironment);
