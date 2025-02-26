function isPWA() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone ||
           document.referrer.includes('android-app://');
}

function setupEnvironment() {
    const appContainer = document.getElementById('app-container');
    const readmeContainer = document.getElementById('readme-container');
    const appStyles = document.getElementById('app-styles');

    if (!document.getElementById('readme-styles')) {
        const readmeStyles = document.createElement('style');
        readmeStyles.id = 'readme-styles';
        readmeStyles.textContent = `
            #readme-container {
                height: auto !important;
                min-height: auto !important;
                overflow: auto !important;
                position: static !important;
                padding: 20px !important;
                max-width: 800px !important;
                margin: 0 auto !important;
            }
            body:not(.pwa-mode) {
                height: auto !important;
                min-height: auto !important;
                overflow: auto !important;
                position: static !important;
            }
        `;
        document.head.appendChild(readmeStyles);
    }

    if (isPWA()) {
        document.body.classList.add('pwa-mode');
        if (readmeContainer) readmeContainer.style.display = 'none';
        if (appContainer) appContainer.style.display = 'block';
        if (appStyles) appStyles.disabled = false;
        document.getElementById('readme-styles').disabled = true;
        document.documentElement.classList.add('ready');
    } else {
        document.body.classList.remove('pwa-mode');
        if (appContainer) appContainer.style.display = 'none';
        if (appStyles) appStyles.disabled = true;
        document.getElementById('readme-styles').disabled = false;
        
        fetch('README.md')
            .then(response => response.text())
            .then(markdown => {
                if (readmeContainer && window.marked) {
                    readmeContainer.innerHTML = marked.parse(markdown);
                    readmeContainer.style.display = 'block';
                    document.documentElement.classList.add('ready');
                }
            })
            .catch(error => {
                console.error('Error loading README:', error);
                document.documentElement.classList.add('ready');
            });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupEnvironment);
} else {
    setupEnvironment();
}

window.matchMedia('(display-mode: standalone)').addEventListener('change', setupEnvironment);
