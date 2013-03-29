function simpleTransition() {
    $('#miloSimple').css({
        left : $('#miloSimple').position().left + 100
    });
}

function complexTransition() {
    $('#miloComplex').css({
        left : 400,
        opacity : 1
    });
}

function threedTransition() {
    var animateX = Math.round(Math.random());
    var animateY = Math.round(Math.random());
    var animateZ = Math.round(Math.random());

    var angle = Math.round(Math.random() * 360);
    $('#milo3d').css({
        '-webkit-transform' : 'rotate3d(' + animateX + ',' + animateY + ',' + animateZ + ',' + angle + 'deg)'
    });
}

function animate() {
    $('#miloAnimated').css({
        '-webkit-animation' : 'FLYING-MILO 3s 0s infinite'
    });
}

function applyAnim(button) {
    var target = $('#'+button.id.substring(6));
    var animClass = "anim";
    if (target.hasClass(animClass)){
        target.removeClass(animClass);
        setTimeout(function(){ target.addClass(animClass); }, 500);
    }else{
        $(target).addClass(animClass);
    }
}