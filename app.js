// Step: 1 The State
class Picture {
    constructor(width, height, pixels) {
        this.width = width;
        this.height = height;
        this.pixels = pixels;
    }
    static empty(width, height, color) {
        let pixels = new Array(width * height).fill(color);
        return new Picture(width, height, pixels);
    }
    pixel(x, y) {
        return this.pixels[x + y * this.width];
    }
    draw(pixels) {
        let copy = this.pixels.slice();
        for (let { x, y, color } of pixels) {
            copy[x + y * this.width] = color;
        }
        return new Picture(this.width, this.height, copy);
    }
}

function updateState(state, action) {
    return Object.assign({}, state, action);
}


// Step: 2 DOM Building
function elt(type, props, ...children) {
    let dom = document.createElement(type);
    if (props) Object.assign(dom, props);
    for (let child of children) {
        if (typeof child != "string") dom.appendChild(child);
        else dom.appendChild(document.createTextNode(child));
    }
    return dom;
}
// This allows the following style of registering event handlers:
// <body>    
//     <script>
//         document.body.appendChild(elt("button", {
//           onclick: () => console.log("click")
//         }, "The button"));
//     </script>
// </body>

// function elt(name, attrs, ...children) {
//     let dom = document.createElement(name);
//     for (let attr of Object.keys(attrs)) {
//       dom.setAttribute(attr, attrs[attr]);
//     }
//     for (let child of children) {
//       dom.appendChild(child);
//     }
//     return dom;
// }



// Step: 3 The Canvas
// This component is responsible for two things: showing a picture and communicating pointer events on that picture to the rest of the application.
const scale = 10; // We draw each pixel as a 10-by-10 square, as determined by the scale constant.

class PictureCanvas {
    constructor(picture, pointerDown) {
        this.dom = elt("canvas", {
            onmousedown: event => this.mouse(event, pointerDown),
            ontouchstart: event => this.touch(event, pointerDown)
        });
        this.syncState(picture);
    }

    // To avoid unnecessary work, the component keeps track of its current picture and does a redraw only when syncState is given a new picture.
    syncState(picture) {
        if (this.picture == picture) return;
        this.picture = picture;
        drawPicture(this.picture, this.dom, scale);
    }
}



// The actual drawing function sets the size of the canvas based on the scale and picture size and fills it with a series of squares, one for each pixel.
function drawPicture(picture, canvas, scale) {
    canvas.width = picture.width * scale;
    canvas.height = picture.height * scale;
    let cx = canvas.getContext("2d");

    for (let y = 0; y < picture.height; y++) {
        for (let x = 0; x < picture.width; x++) {
            cx.fillStyle = picture.pixel(x, y);
            cx.fillRect(x * scale, y * scale, scale, scale);
        }
    }
}

PictureCanvas.prototype.mouse = function (downEvent, onDown) {
    if (downEvent.button != 0) return;
    let pos = pointerPosition(downEvent, this.dom);
    let onMove = onDown(pos);
    if (!onMove) return;
    let move = moveEvent => {
        if (moveEvent.buttons == 0) {
            this.dom.removeEventListener("mousemove", move);
        } else {
            let newPos = pointerPosition(moveEvent, this.dom);
            if (newPos.x == pos.x && newPos.y == pos.y) return;
            pos = newPos;
            onMove(newPos);
        }
    };
    this.dom.addEventListener("mousemove", move);
};

function pointerPosition(pos, domNode) {
    let rect = domNode.getBoundingClientRect();
    return {
        x: Math.floor((pos.clientX - rect.left) / scale),
        y: Math.floor((pos.clientY - rect.top) / scale)
    };
}

PictureCanvas.prototype.touch = function (startEvent, onDown) {
    let pos = pointerPosition(startEvent.touches[0], this.dom);
    let onMove = onDown(pos);
    startEvent.preventDefault();
    if (!onMove) return;
    let move = moveEvent => {
        let newPos = pointerPosition(moveEvent.touches[0], this.dom);
        if (newPos.x == pos.x && newPos.y == pos.y) return;
        pos = newPos;
        onMove(newPos);
    };
    let end = () => {
        this.dom.removeEventListener("touchmove", move);
        this.dom.removeEventListener("touchend", end);
    };
    this.dom.addEventListener("touchmove", move);
    this.dom.addEventListener("touchend", end);
};


// Step: 4 The Application
class PixelEditor {
    constructor(state, config) {
        let { tools, controls, dispatch } = config;
        this.state = state;

        this.canvas = new PictureCanvas(state.picture, pos => {
            let tool = tools[this.state.tool];
            let onMove = tool(pos, this.state, dispatch);
            if (onMove) return pos => onMove(pos, this.state);
        });
        this.controls = controls.map(
            Control => new Control(state, config));
        this.dom = elt("div", {}, this.canvas.dom, elt("br"),
            ...this.controls.reduce(
                (a, c) => a.concat(" ", c.dom), []));
    }
    syncState(state) {
        this.state = state;
        this.canvas.syncState(state.picture);
        for (let ctrl of this.controls) ctrl.syncState(state);
    }
}

class ToolSelect {
    constructor(state, { tools, dispatch }) {
        this.select = elt("select", {
            onchange: () => dispatch({ tool: this.select.value })
        }, ...Object.keys(tools).map(name => elt("option", {
            selected: name == state.tool
        }, name)));
        this.dom = elt("label", null, "🖌 Tool: ", this.select);
    }
    syncState(state) { this.select.value = state.tool; }
}

// This control creates such a field and wires it up to stay synchronized with the application state’s color property.
class ColorSelect {
    constructor(state, { dispatch }) {
        this.input = elt("input", {
            type: "color",
            value: state.color,
            onchange: () => dispatch({ color: this.input.value })
        });
        this.dom = elt("label", null, "🎨 Color: ", this.input);
    }
    syncState(state) { this.input.value = state.color; }
}


// Step: 5 Drawing Tools
function draw(pos, state, dispatch) {
    function drawPixel({ x, y }, state) {
        let drawn = { x, y, color: state.color };
        dispatch({ picture: state.picture.draw([drawn]) });
    }
    drawPixel(pos, state);
    return drawPixel;
}

// To draw larger shapes, it can be useful to quickly create rectangles. The rectangle tool draws a rectangle between the point where you start dragging and the point that you drag to.
function rectangle(start, state, dispatch) {
    function drawRectangle(pos) {
        let xStart = Math.min(start.x, pos.x);
        let yStart = Math.min(start.y, pos.y);
        let xEnd = Math.max(start.x, pos.x);
        let yEnd = Math.max(start.y, pos.y);
        let drawn = [];
        for (let y = yStart; y <= yEnd; y++) {
            for (let x = xStart; x <= xEnd; x++) {
                drawn.push({ x, y, color: state.color });
            }
        }
        dispatch({ picture: state.picture.draw(drawn) });
    }
    drawRectangle(start);
    return drawRectangle;
}


// We are using the pathfinding code. This code searches through a grid to find all “connected” pixels. The problem of keeping track of a branching set of possible routes is similar.
const around = [{ dx: -1, dy: 0 }, { dx: 1, dy: 0 },
{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }];

function fill({ x, y }, state, dispatch) {
    let targetColor = state.picture.pixel(x, y);
    let drawn = [{ x, y, color: state.color }];
    for (let done = 0; done < drawn.length; done++) {
        for (let { dx, dy } of around) {
            let x = drawn[done].x + dx, y = drawn[done].y + dy;
            if (x >= 0 && x < state.picture.width &&
                y >= 0 && y < state.picture.height &&
                state.picture.pixel(x, y) == targetColor &&
                !drawn.some(p => p.x == x && p.y == y)) {
                drawn.push({ x, y, color: state.color });
            }
        }
    }
    dispatch({ picture: state.picture.draw(drawn) });
}

// The tool is a color picker, which allows you to point at a color in the picture to use it as the current drawing color.
function pick(pos, state, dispatch) {
    dispatch({ color: state.picture.pixel(pos.x, pos.y) });
}


// Step: 6 Saving And Loading
// add a button for downloading the current picture as an image file and save the image.
class SaveButton {
    constructor(state) {
        this.picture = state.picture;
        this.dom = elt("button", {
            onclick: () => this.save()
        }, "💾 Save");
    }
    save() {
        let canvas = elt("canvas");
        drawPicture(this.picture, canvas, 1);
        let link = elt("a", {
            href: canvas.toDataURL(),
            download: "pixelart.png"
        });
        document.body.appendChild(link);
        link.click();
        link.remove();
    }
    syncState(state) { this.picture = state.picture; }
}
//The component keeps track of the current picture so that it can access it when saving. To create the image file, we uses a <canvas> element that it draws the picture on (at a scale of one pixel per pixel).


// To load existing image files into our application.
class LoadButton {
    constructor(_, { dispatch }) {
        this.dom = elt("button", {
            onclick: () => startLoad(dispatch)
        }, "📁 Load");
    }
    syncState() { }
}

function startLoad(dispatch) {
    let input = elt("input", {
        type: "file",
        onchange: () => finishLoad(input.files[0], dispatch)
    });
    document.body.appendChild(input);
    input.click();
    input.remove();
}


// When the user has selected a file, we can use FileReader to get access to its contents, again as a data URL. That URL can be used to create an <img> element, but because we can’t get direct access to the pixels in such an image, we can’t create a Picture object from that.
function finishLoad(file, dispatch) {
    if (file == null) return;
    let reader = new FileReader();
    reader.addEventListener("load", () => {
      let image = elt("img", {
        onload: () => dispatch({
          picture: pictureFromImage(image)
        }),
        src: reader.result
      });
    });
    reader.readAsDataURL(file);
}

// To get access to the pixels, we must first draw the picture to a <canvas> element. The canvas context has a getImageData method that allows a script to read its pixels. So, once the picture is on the canvas, we can access it and construct a Picture object.
function pictureFromImage(image) {
    let width = Math.min(100, image.width);
    let height = Math.min(100, image.height);
    let canvas = elt("canvas", {width, height});
    let cx = canvas.getContext("2d");
    cx.drawImage(image, 0, 0);
    let pixels = [];
    let {data} = cx.getImageData(0, 0, width, height);
  
    function hex(n) {
      return n.toString(16).padStart(2, "0");
    }
    for (let i = 0; i < data.length; i += 4) {
      let [r, g, b] = data.slice(i, i + 3);
      pixels.push("#" + hex(r) + hex(g) + hex(b));
    }
    return new Picture(width, height, pixels);
}

// Step: 7 UNDO History
function historyUpdateState(state, action) {
    if (action.undo == true) {
      if (state.done.length == 0) return state;
      return Object.assign({}, state, {
        picture: state.done[0],
        done: state.done.slice(1),
        doneAt: 0
      });
    } else if (action.picture &&
               state.doneAt < Date.now() - 1000) {
      return Object.assign({}, state, action, {
        done: [state.picture, ...state.done],
        doneAt: Date.now()
      });
    } else {
      return Object.assign({}, state, action);
    }
}

class UndoButton {
    constructor(state, {dispatch}) {
      this.dom = elt("button", {
        onclick: () => dispatch({undo: true}),
        disabled: state.done.length == 0
      }, "⮪ Undo");
    }
    syncState(state) {
      this.dom.disabled = state.done.length == 0;
    }
}

// Step: 8 Let's Draw
const startState = {
    tool: "draw",
    color: "#000000",
    picture: Picture.empty(60, 30, "#f0f0f0"),
    done: [],
    doneAt: 0
};
  
const baseTools = {draw, fill, rectangle, pick};
  
const baseControls = [
    ToolSelect, ColorSelect, SaveButton, LoadButton, UndoButton
];
  
function startPixelEditor({state = startState,
                             tools = baseTools,
                             controls = baseControls}) {
    let app = new PixelEditor(state, {
      tools,
      controls,
      dispatch(action) {
        state = historyUpdateState(state, action);
        app.syncState(state);
      }
    });
    return app.dom;
}