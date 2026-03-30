window.toast = (() => {
    let el = null;
    let timeout = null;
    return (msg) => {
        if (!el) {
            el = document.createElement('div');
            el.className = 'toast';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(timeout);
        timeout = setTimeout(() => el.classList.remove('show'), 3000);
    };
})();
