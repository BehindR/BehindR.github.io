document.addEventListener('DOMContentLoaded', function () {
    const toggleButton = document.querySelector('.navbar-toggle');
    const navbarLinks = document.querySelector('.navbar-menu ul');

    toggleButton.addEventListener('click', () => {
        navbarLinks.classList.toggle('active');
        
    });

    const boxes = document.querySelectorAll('.box');

    // Function to handle visibility on scroll
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
