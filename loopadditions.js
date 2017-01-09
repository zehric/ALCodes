// cgoo and arena switching
var lastmvamp;
loopAddition = function () {
  if (character.map === 'batcave' && 
      (!parent.ctarget || parent.ctarget.mtype !== 'mvampire') 
      && character.real_x !== 0 && character.real_y !== 0) move(0,0);

  if (character.map !== 'batcave' && lastmvamp && 
      new Date() - lastmvamp > 1075000) {
    parent.socket.emit('transport', {to: 'batcave'});
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

// mvamp stealing
handle_command = function (command, args) {
  if (command === 'checkmvamp') {
    game_log(new Date(lastmvamp.getTime() + 1080000) - new Date());
  }
}
var lastmvamp;
var tped = false;
loopAddition = function () {
  if (new Date() - lastmvamp > 1020000 && new Date() - lastmvamp < 1020100) {
    show_json('1 minute to mvamp');
    useAbilities = false;
  }
  if (parent.ctarget && parent.ctarget.mtype === 'mvampire' 
      && parent.ctarget.dead) {
    lastmvamp = new Date();
    pathBack();
    tped = false;
  }
  var interval;
  if (character.map !== 'batcave' && lastmvamp && 
      new Date() - lastmvamp > 1075000 && !tped) {
    parent.socket.emit('transport', {to: 'batcave'});
    useAbilities = 10000;
    setTimeout(function () {
      currentPoint = null; currentPath = null; move(50, 8);
      interval = setInterval(function () {
        change_target(searchTargets(100000, 100000, parent.ctarget));
        var t = get_target();
        if (t && t.mtype === 'mvampire') {
          supershot(t);
		  clearInterval(interval);
        }
      }, 0)
    }, 200);
    tped = true;
  }
}
