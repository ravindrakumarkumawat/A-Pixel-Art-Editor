function circle(pos, state, dispatch) {
    function drawCircle(to) {
      let radius = Math.sqrt(Math.pow(to.x - pos.x, 2) +
                             Math.pow(to.y - pos.y, 2));
      let radiusC = Math.ceil(radius);
      let drawn = [];
      for (let dy = -radiusC; dy <= radiusC; dy++) {
        for (let dx = -radiusC; dx <= radiusC; dx++) {
          let dist = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
          if (dist > radius) continue;
          let y = pos.y + dy, x = pos.x + dx;
          if (y < 0 || y >= state.picture.height ||
              x < 0 || x >= state.picture.width) continue;
          drawn.push({x, y, color: state.color});
        }
      }
      dispatch({picture: state.picture.draw(drawn)});
    }
    drawCircle(pos);
    return drawCircle;
}