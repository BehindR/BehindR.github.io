document.addEventListener('DOMContentLoaded', function () {
    const toggleButton = document.querySelector('.navbar-toggle');
    const navbarMenu = document.querySelector('.navbar-menu');

    toggleButton.addEventListener('click', () => {
        navbarMenu.classList.toggle('active');
    });

    // Menutup menu saat klik di luar navbar
    document.addEventListener('click', function (event) {
        if (!toggleButton.contains(event.target) && !navbarMenu.contains(event.target)) {
            navbarMenu.classList.remove('active');
        }
    });

    const boxes = document.querySelectorAll('.box');

    const showOnScroll = () => {
        boxes.forEach(box => {
            const boxTop = box.getBoundingClientRect().top;
            const boxBottom = box.getBoundingClientRect().bottom;
            const windowHeight = window.innerHeight;

            if (boxTop < windowHeight - 100 && boxBottom > 0) {
                box.classList.add('show');
            } else {
                box.classList.remove('show');
            }
        });
    };

    window.addEventListener('scroll', showOnScroll);
    showOnScroll();
});

