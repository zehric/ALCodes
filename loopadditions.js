// put this for all setups 
var leftJail = false;
if (character.map === 'jail') {
  if (!strongEnemy || new Date() - strongEnemy > 60000) {
    parent.socket.emit('leave');
    leftJail = true;
  }
}

// left snakes
if (leftJail) {
  parent.socket.emit('transport', {to: 'halloween'});
  leftJail = false;
}
if (character.map === 'halloween') {
  chainMove([0, -520], [0, -100]);
}

// poms
if (leftJail) {
  parent.socket.emit('transport', {to: 'halloween'});
  leftJail = false;
}
if (character.map === 'halloween') {
  chainMove([0, 0], [0, -500]);
}

// bats
if (leftJail) {
  parent.socket.emit('transport', {to: 'batcave'});
  leftJail = false;
}

// cgoos
if (leftJail) {
  parent.socket.emit('transport', {to: 'arena'});
  leftJail = false;
}
if (!parent.ctarget && character.map === 'arena') {
  var x = character.real_x;
  var y = character.real_y;
  if (x > -112 && x < 400 && y >= -370) {
    move(-200, -70);
  } else if (x < 400 && y >= -370) {
    move(-215, -670);
  } else if (x < 400 && y < -370) {
    move(900, -670);
  } else if (x >= 400 && y < -150) {
    move(900, -60);
  } else if (x >= 400 && y >= -150) {
    move(-200, 70);
  }
}

// scorpions
if (leftJail) {
  chainMove([41, 40, 861, 1160], [-71, 53, 288, 761]);
  leftJail = false;
}
