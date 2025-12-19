// Footer Loader - Include this script on every page
// Usage: <footer id="site-footer"></footer> + <script src="/includes/footer-loader.js"></script>

(function() {
    const footer = document.getElementById('site-footer');
    if (footer) {
        fetch('/includes/footer.html')
            .then(response => response.text())
            .then(html => {
                footer.innerHTML = html;
            })
            .catch(err => console.error('Footer load error:', err));
    }
})();
