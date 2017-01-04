// cgoo and arena switching
var lastmvamp;
loopAddition = function () {
  if (character.map === 'batcave' && 
      (!parent.ctarget || parent.ctarget.mtype !== 'mvampire') 
      && character.real_x !== 0 && character.real_y !== 0) move(0,0);

  if (character.map !== 'batcave' && lastmvamp && 
      new Date() - lastmvamp > 1080000) {
    parent.socket.emit('transport', {to: 'batcave'});
    setTimeout(function () {
      if (!parent.ctarget || parent.ctarget.mtype !== 'mvampire') {
        parent.socket.emit('transport', {to: 'arena'});
      }
    }, 5000);
  }

  if (parent.ctarget && parent.ctarget.mtype === 'mvampire' 
    && parent.ctarget.dead) {
    lastmvamp = new Date();
    parent.socket.emit('transport', {to: 'arena'});
  }

  if (!parent.ctarget && character.map === 'arena') {
    var x = character.real_x;
    var y = character.real_y;
    if (x > -112 && x < 400 && y >= -370 && !character.moving) {
      move(-200, -70);
    } else if (x < 400 && y >= -370 && !character.moving) {
      move(-215, -670);
    } else if (x < 400 && y < -370 && !character.moving) {
      move(900, -670);
    } else if (x >= 400 && y < -150 && !character.moving) {
      move(900, -60);
    } else if (x >= 200 && y >= -150) {
      parent.socket.emit('town');
    }
  }
};
