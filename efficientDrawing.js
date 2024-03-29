PictureCanvas.prototype.syncState = function(picture) {
    if (this.picture == picture) return;
    drawPicture(picture, this.dom, scale, this.picture);
    this.picture = picture;
}

function drawPicture(picture, canvas, scale, previous) {
    if (previous == null ||
        previous.width != picture.width || previous.height != picture.height) {
        canvas.width = picture.width * scale;
        canvas.height = picture.height * scale;
        previous = null;
    }

    let cx = canvas.getContext("2d");
    for (let y = 0; y < picture.height; y++) {
        for (let x = 0; x < picture.width; x++) {
            let color = picture.pixel(x, y);
            if (previous == null || previous.pixel(x, y) != color) {
            cx.fillStyle = color;
            cx.fillRect(x * scale, y * scale, scale, scale);
            }
        }
    }
}