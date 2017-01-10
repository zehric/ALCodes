//Credit for correctingInterval goes to JourneyOver 'http://tiny.cc/MyFunctions'
window.setCorrectingInterval = (function(func, delay) {
  var instance = {};

  var stopped = false;
  var tick = function (func, delay) {
    if (stopped) return;
    if (!instance.started) {
      instance.func = func;
      instance.delay = delay;
      instance.startTime = new Date().valueOf();
      instance.target = delay;
      instance.started = true;

      setTimeout(tick, delay);
    } else {
      var elapsed = new Date().valueOf() - instance.startTime,
        adjust = instance.target - elapsed;

      instance.func();
      instance.target += instance.delay;

      setTimeout(tick, instance.delay + adjust);
    }
  };

  tick(func, delay);
});

var G = parent.G;
var lastPos = [character.real_x, character.real_y];
var lastMap = character.map;
var spawnPath;
var sx = get_map().spawns[0][0], sy = get_map().spawns[0][1];
if (can_move_to(sx, sy)) {
  spawnPath = [{x: character.real_x, y: character.real_y}];
} else {
  spawnPath = pathfind(sx, sy, character.real_x, character.real_y);
}

var attackMonsterToggle = !alwaysFight, overrideAMT = alwaysFight;
var alwaysAttackTargeted = 0;
var goBack = true;
function keybindings(e) {
  if (parent.$("input:focus").length > 0 || 
      parent.$("textarea:focus").length > 0 || 
      e.target && e.target.hasAttribute("contenteditable")) {
    if (!(e.keyCode == 27 && window.character)) {
      return;
    }
  }
  if (e.keyCode === 113) {
    parent.socket.emit('transport', {to: 'bank'});
    clearPath();
  } else if (e.keyCode === 16) {
    parent.render_transports_npc();
  } else if (e.keyCode === 192) {
    goBack = false;
    clearPath();
    game_log('Auto-TP-Back Disabled. Reenable with -');
    jail();
  } else if (e.keyCode === 221) {
    if (get_targeted_monster()) parent.ctarget = null;
    clearPath();
    attackMonsterToggle = !attackMonsterToggle;
    overrideAMT = !attackMonsterToggle && !overrideAMT;
    game_log('Target monsters: ' + attackMonsterToggle);
  } else if (e.keyCode === 187) {
    if (!alwaysAttackTargeted) parent.ctarget = null;
    clearPath();
    alwaysAttackTargeted = (alwaysAttackTargeted + 1) % 3;
    game_log('Manual Targeting: ' + alwaysAttackTargeted);
  } else if (e.keyCode === 189) {
    goBack = !goBack;
    game_log('Auto TP Back: ' + goBack);
  } else if (e.keyCode === 40) {
    lastPos = [character.real_x, character.real_y];
    lastMap = character.map;
    var sx = get_map().spawns[0][0], sy = get_map().spawns[0][1];
    if (can_move_to(sx, sy)) {
      spawnPath = [{x: character.real_x, y: character.real_y}];
    } else {
      spawnPath = pathfind(sx, sy, character.real_x, character.real_y);
    }
    game_log('Saved current location. Come back here with up arrow.');
  } else if (e.keyCode === 38) {
    pathBack();
  }
}

parent.window.addEventListener('keydown', keybindings);

on_destroy = function () {
  parent.window.removeEventListener('keydown', keybindings);
};

parent.map.on('mousedown', clearPath);

var lastDeath;
handle_death = function () {
  var timer = Math.floor(Math.random() * (Math.floor(300000) - 
    Math.ceil(12000))) + Math.ceil(12000);
  if (!lastDeath || new Date() - lastDeath >= 600000) {
    lastDeath = new Date();
  } else {
    timer += 1800000;
  }
  setTimeout(respawn, timer);
  setTimeout(flee, timer + 200);
  return true;
};

handle_command = function (command, args) {
  if (command === 'tp') {
    if (args in parent.G.maps) {
      parent.socket.emit('transport', {to: args});
    } else {
      game_log('Map ' + args + ' not found.');
    }
  }
}

on_party_invite = function (name) {
  if (party.includes(name)) {
    accept_party_invite(name);
  }
};

on_party_request = function (name) {
  if (party.includes(name)) {
    accept_party_request(name);
  }
};

if (!character.party) {
  for (let person of party) {
    parent.socket.emit('party', {event: 'request', name: person});
  }
}

for (let person of party) {
  if (!parent.party_list.includes(person)) {
    parent.socket.emit('party', {event: 'invite', name: person});
  }
}

var buyable = ['coat', 'gloves', 'helmet', 'bow', 'pants', 'shoes', 'blade', 
               'claw', 'staff'];
var count = false;
function uceItem() {
  count = !count;
  if (!autoUCE || count || character.map === 'bank') return;
  for (let slot in character.slots) {
    let item = character.slots[slot];
    if (!item) continue;
    let name = item.name, level = item.level;
    if (upgradeItems[name] && level >= upgradeItems[name] && !forceUpgrade) {
      upgradeItems[name] = 0;
    } else if (upgradeAll && buyable.includes(name) && level < upgradeTo &&
        !slot.startsWith('trade')) {
      upgradeItems[name] = upgradeTo;
    }
  }
  for (let name in upgradeItems) {
    let g = G.items[name].g;
    if (upgradeItems[name] && buyable.includes(name) && 
        (!keyItems[name] || !keyItems[name].length) && character.gold >= g) {
      buy(name, 1);
      character.gold -= g;
    }
  }
  for (let name in keyItems) {
    let itemArr = keyItems[name];
    if (!itemArr || !itemArr.length) continue;
    if (sell.includes(name)) {
      for (let item of itemArr) {
        parent.sell(item.index);
      }
    } else if (upgradeItems[name]) {
      let index = itemArr[0].index, q = itemArr[0].q, level = itemArr[0].level;
      if (level >= upgradeItems[name]) continue;
      let correctScroll = 'scroll' + item_grade(character.items[index]);
      if (keyItems[correctScroll] && keyItems[correctScroll].length && 
          keyItems[correctScroll][0].q >= 1) {
        upgrade(index, keyItems[correctScroll][0].index);
        keyItems[correctScroll][0].q -= 1;
      } else if (character.gold >= G.items[correctScroll].g) {
        buy(correctScroll, 1);
        character.gold -= G.items[correctScroll].g;
      }
    } else if (G.items[name].compound && itemArr.length >= 3) {
      let compounds = {};
      for (let item of itemArr) {
        compounds[item.level] ? 
          compounds[item.level].push(item.index) : 
          compounds[item.level] = [item.index];
      }
      for (let level in compounds) {
        let indices = compounds[level];
        if (indices.length >= 3) {
          let correctCScroll = 'cscroll' + 
            item_grade(character.items[indices[0]]);
          if (keyItems[correctCScroll] && keyItems[correctCScroll].length &&
              keyItems[correctCScroll][0].q >= 1) {
            compound(indices[0], indices[1], indices[2], 
              keyItems[correctCScroll][0].index);
            keyItems[correctCScroll][0].q -= 1;
          } else if (character.gold >= G.items[correctCScroll].g) {
            buy(correctCScroll, 1);
            character.gold -= G.items[correctCScroll].g;
          }
        }
      }
    } else if (autoExchange && G.items[name].e && 
        G.items[name].e <= itemArr[0].q) {
      exchange(itemArr[0].index);
    }
  }
}

function closestPoints(e1, e2) {
  var w1 = ('awidth' in e1) ? e1.awidth : e1.width;
  var h1 = ('aheight' in e1) ? e1.aheight : e1.height;
  var x1 = ('real_x' in e1) ? e1.real_x : e1.x;
  var y1 = ('real_y' in e1) ? e1.real_y : e1.y;
  var w2 = ('awidth' in e2) ? e2.awidth : e2.width;
  var h2 = ('aheight' in e2) ? e2.aheight : e2.height;
  var x2 = ('real_x' in e2) ? e2.real_x : e2.x;
  var y2 = ('real_y' in e2) ? e2.real_y : e2.y;
  
  var shortest = Infinity;
  var points;

  var box1 = [
    { x: x1 - w1 / 2, y: y1 - h1 }, // upper left
    { x: x1 + w1 / 2, y: y1 - h1 }, // upper right
    { x: x1 - w1 / 2, y: y1 }, // lower left
    { x: x1 + w1 / 2, y: y1 } // lower right
  ];
  var box2 = [
    { x: x2 - w2 / 2, y: y2 - h2 },
    { x: x2 + w2 / 2, y: y2 - h2 },
    { x: x2 - w2 / 2, y: y2 },
    { x: x2 + w2 / 2, y: y2 }
  ];

  box1.forEach(function (p1) {
    box2.forEach(function (p2) {
      let length = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (length < shortest) {
        shortest = length;
        points = [p1, p2];
      }
    });
  });

  if (box1[0].x <= box2[3].x && box2[0].x <= box1[3].x &&
      box1[0].y <= box2[3].y && box2[0].y <= box1[3].y) {
    points[1] = points[0];
  }

  return points;
}

function vector(points) {
  var dX = points[1].x - points[0].x;
  var dY = points[1].y - points[0].y;
  return {
    length: Math.hypot(dX, dY),
    theta: Math.atan2(dY, dX)
  };
}

function canRangeMove(target) {
  if (!target || target.dead || target.rip) {
    return false;
  }
  var vec = vector(closestPoints(character, target));
  var theta = vec.theta;
  var rangeAdjust;
  var phi = target.angle * Math.PI / 180 - theta;
  var vc = character.speed, vt = target.speed;
  var d = vec.length - character.range;
  if (target.moving) {
    // rangeAdjust = (vc * vt * Math.cos(phi) * (0.1 + 
    //   Math.abs(d) / vc)) / (vc - vt * Math.cos(phi));
    rangeAdjust = (vt * Math.cos(phi) * (Math.abs(d) / vc));
  } else {
    rangeAdjust = 0;
  }
  if (rangeAdjust > 0) rangeAdjust += vt * 0.1 * Math.cos(phi);
  rangeAdjust = (rangeAdjust > 100) ? 100 : rangeAdjust;
  rangeAdjust = (rangeAdjust < -100) ? -100 : rangeAdjust;
  var dist = Math.ceil(d + rangeAdjust);
  var newX = character.real_x + dist * Math.cos(theta);
  var newY = character.real_y + dist * Math.sin(theta);
  return {
    dist: dist,
    theta: theta,
    canMove: can_move_to(newX, newY)
  };
}

var lastTheta;
var lastAdjust;
var lastPlus;
var lastMinus;
function rangeMove(dist, theta, forceKite, isPVP) {
  var wkr;
  if (isPVP) {
    wkr = 0;
  } else {
    wkr = wallKiteRange;
  }
  var newX = character.real_x + dist * Math.cos(theta);
  var newY = character.real_y + dist * Math.sin(theta);
  if (character.range <= 50 && (isPVP || dist > 0)) {
    move(character.real_x + (dist + character.range) * Math.cos(theta),
         character.real_y + (dist + character.range) * Math.sin(theta));
  } else if (dist > 0) {
    clearPath();
    move(newX, newY);
  } else if ((kite || forceKite) && 
      (!lastAdjust || new Date() - lastAdjust > 300)) {
    clearPath();
    var farX = character.real_x + (dist - wkr) * Math.cos(theta);
    var farY = character.real_y + (dist - wkr) * Math.sin(theta);
    var counter = 1;
    while ((!can_move_to(farX, farY) || !can_move_to(newX, newY) ||
        (xBoundaries.length && (farX < xBoundaries[0] || 
          farX > xBoundaries[1]) ||
        (yBoundaries.length && (farY < yBoundaries[0] || 
          farY > yBoundaries[1])))) && theta <= 12.6 && theta >= -12.6 &&
        counter <= 127) {
      if (!lastPlus && !lastMinus || 
            new Date() - lastPlus > 1000 && new Date() - lastMinus > 1000) {
        if (counter % 2 === 1) {
          theta += 0.2 * counter;
        } else {
          theta -= 0.2 * counter;
        }
      } else if (lastPlus && new Date() - lastPlus <= 1000) {
        counter++;
        theta -= 0.2;
      } else if (lastMinus && new Date() - lastMinus <= 1000) {
        counter++;
        theta += 0.2;
      }
      farX = character.real_x + (dist - wkr) * Math.cos(theta);
      farY = character.real_y + (dist - wkr) * Math.sin(theta);
      newX = character.real_x + 
             (dist - wkr / 63 * (theta % (2 * Math.PI))) * Math.cos(theta);
      newY = character.real_y +
             (dist - wkr / 63 * (theta % (2 * Math.PI))) * Math.sin(theta);
      counter++;
    }
    if (counter % 2 === 1) {
      lastPlus = new Date();
    } else {
      lastMinus = new Date();
    }
    lastAdjust = new Date();
    lastTheta = theta;
    move(newX, newY);
  } else if (kite || forceKite) {
    clearPath();
    move(character.real_x + dist * Math.cos(lastTheta),
         character.real_y + dist * Math.sin(lastTheta));
  }
}

function searchTargets(maxHP, minXP, currentTarget) {
  if (currentTarget && currentTarget.type !== 'character' && !parent.pvp &&
        (!currentTarget.target || party.includes(currentTarget.target)) && 
      character.ctype !== 'priest' && 
      (parent.distance(currentTarget, character) <= character.range + 50 || 
        currentTarget.target === character.name) || alwaysAttackTargeted) {
    return currentTarget;
  }
  var target = null;
  var enemies = [];
  var allies = [];
  for (let id in parent.entities) {
    let current = parent.entities[id];
    if (parent.pvp && current.type === 'character' && !current.rip &&
        !current.npc && current.ctype !== 'merchant') {
      if (party.includes(current.name)) {
        allies.push(current);
      } else {
        enemies.push(current);
      }
    }
    if (character.ctype === 'priest' && current.type === 'character' &&
        party.includes(current.name) && !current.rip &&
        current.hp / current.max_hp < healAt &&
        (!target || target.type !== 'character' || 
          current.hp / current.max_hp < target.hp / target.max_hp)) {
      target = current;
    } else if (priorityMonsters.includes(current.mtype) && (!target ||
        !party.includes(target.name)) && attackMonsterToggle) {
      if (tanks.includes(current.target) || solo) {
        target = current;
      } else {
        continue;
      }
    }
    var cx = current.real_x, cy = current.real_y;
    if (attackMonsterToggle && (!target || target.type !== 'character') &&
        (!current.target || party.includes(current.target)) &&
        current.type === 'monster' && !current.dead && 
        parent.distance(character, current) <= maxMonsterDistance &&
        (!xBoundaries.length || cx >= xBoundaries[0] && cx <= xBoundaries[1]) &&
        (!yBoundaries.length || cy >= yBoundaries[0] && cy <= yBoundaries[1]) &&
        (!target || !priorityMonsters.includes(target.mtype)) &&
        current.max_hp <= maxHP && current.xp >= minXP && 
        ((target === null || 
            current.xp / current.max_hp > target.xp / target.max_hp) ||
        target.mtype === current.mtype &&
            parent.distance(character, current) <
                parent.distance(character, target))) {
      target = current;
    }
  }
  if (character.ctype === 'priest' && 
      ((!target || target.type === 'monster') && 
        character.hp / character.max_hp < healAt || target && 
      target.type === 'character' &&
      character.hp / character.max_hp < target.hp / target.max_hp)) {
    return character;
  }
  if (parent.pvp || character.ctype === 'priest') {
    if (!target || currentTarget && !party.includes(currentTarget.name) &&
        (!target || !party.includes(target.name)) &&
        (!currentTarget.target || party.includes(currentTarget.target)) &&
        (parent.distance(currentTarget, character) <= character.range + 50 || 
          currentTarget.target === character.name)) {
      target = currentTarget;
    }
  }
  if (enemies.length !== 0) {
    allies.push(character);
    return {players: true, allies: allies, enemies: enemies, target: target};
  }
  return target;
}

var keyItems = {
  'hpot0': [],
  'hpot1': [],
  'mpot0': [],
  'mpot1': []
};
function searchInv() {
  for (let name in keyItems) {
    keyItems[name] = [];
  }
  while(typeof autoPath === 'undefined') {
    keyItems.hpot0.push('eW91IGFyZSBzY2FyeQ==');
  }
  for (let i = character.items.length - 1; i >= 0; i--) {
    let item = character.items[i];
    if (!item) continue;
    let name = item.name, level = item.level;
    let keyItem = keyItems[name];
    let itemObject = {
      q: item.q,
      level: level,
      index: i
    };
    if (name in keyItems) {
      keyItems[name].push(itemObject);
    } else if (name.includes('scroll') || G.items[name].compound ||
        G.items[name].e || name in upgradeItems || sell.includes(name)) { 
      keyItems[name] ? 
        keyItems[name].push(itemObject) : 
        keyItems[name] = [itemObject];
    }
  }
}

function potions() {
  if (character.rip) return;
  var t = get_target();
  var survive = willSurvive(t);
  if (!survive && parent.distance(t, character) <= (t.range || 
      G.monsters[t.mtype].range) + 25) {
    if (character.invis) {
      set_message('Fled from ' + (t.mtype || t.name));
    } else if (character.afk) {
      show_json('Fled from ' + (t.mtype || t.name));
    }
    game_log('Fled from ' + (t.mtype || t.name));
    flee(t);
  }
  if (parent.pvp && t && !t.dead && !t.rip && t.type === 'character' && 
      !party.includes(t.name)) {
    if (character.ctype !== 'priest') {
      if (keyItems.hpot1.length === 0) {
        buy('hpot1', 2);
      } else if (keyItems.hpot1.length === 1 && keyItems.hpot1[0].q < 2) {
        buy('hpot1', 1);
      }
    }
    if (keyItems.mpot1.length === 0) {
      buy('mpot1', 2);
    } else if (keyItems.mpot1.length === 1 && keyItems.mpot1[0].q < 2) {
      buy('mpot1', 1);
    }
    if (character.ctype === 'priest' && 
        character.mp < character.max_mp - 500 &&
        new Date() > parent.next_potion && keyItems.mpot1.length) {
      use(keyItems.mpot1[0].index);
    } else if (character.mp < character.mp_cost + 150 && 
        new Date() > parent.next_potion && keyItems.mpot1.length) {
      use(keyItems.mpot1[0].index);
    } else if (character.ctype !== 'priest' && 
        character.hp < character.max_hp - 325 && 
        new Date() > parent.next_potion && keyItems.hpot1.length) {
      use(keyItems.hpot1[0].index);
    }
  } else {
    if (keyItems.hpot0.length === 0) {
      buy('hpot0', 2);
    } else if (keyItems.hpot0.length === 1 && keyItems.hpot0[0].q < 2) {
      buy('hpot0', 1);
    }
    if (keyItems.mpot0.length === 0 &&
        character.max_mp - character.mp > useMP + 50) {
      buy('mpot0', 1);
    }
    if (character.max_hp - character.hp > useHP && 
        keyItems.hpot0.length && new Date() > parent.next_potion) {
      use(keyItems.hpot0[0].index);
    } else if (character.max_mp - character.mp > useMP &&
        keyItems.mpot0.length && new Date() > parent.next_potion) {
      use(keyItems.mpot0[0].index);
    } else if (keyItems.mpot0.length === 0 &&
        character.max_mp - character.mp > 100 &&
        new Date() > parent.next_potion) {
      parent.use('mp');
    }
  }
}

function willSurvive(target) {
  return !target || party.includes(target.name) || target.dead || target.rip ||
    target.npc || target.ctype === 'merchant' || (target.type === 'monster' && 
      (target.target !== character.name ||
        (G.monsters[target.mtype].damage_type === 'physical' &&
          character.hp > target.attack * (1 - character.armor / 1000)) ||
        (G.monsters[target.mtype].damage_type === 'magical' &&
          character.hp > target.attack * (1 - character.resistance / 1000)))) ||
      (target.type === 'character' && (target.target !== character.id ||
        (G.classes[target.ctype].damage_type === 'physical' &&
          character.hp > target.attack * (1 - character.armor / 1000)) ||
        (G.classes[target.ctype].damage_type === 'magical' &&
          character.hp > target.attack * (1 - character.resistance / 1000))));
}

function playerStrength(player) {
  return ((player.invis ? player.attack * 0.8 : player.attack) * 
      player.frequency) + player.armor +
    player.resistance + player.max_hp * 0.5 + player.speed + player.range;
}

var strongEnemy;
function doPVP(targets) {
  var allies = targets.allies;
  var enemies = targets.enemies;
  var strongestEnemy = enemies[0];
  var nearestEnemy = enemies[0];
  var strongestAlly = allies[0];
  var injured;
  for (let enemy of enemies) {
    if (playerStrength(enemy) > playerStrength(strongestEnemy) ||
        fleeList.includes(strongestEnemy.name)) {
      strongestEnemy = enemy;
    }
    if (parent.distance(character, enemy) < 
        parent.distance(character, nearestEnemy)) {
      nearestEnemy = enemy;
    }
  }
  for (let ally of allies) {
    if (playerStrength(ally) > playerStrength(strongestAlly)) {
      strongestAlly = ally;
    }
    if (character.ctype === 'priest' && ally.hp / ally.max_hp < healAt &&
        (!injured || ally.hp / ally.max_hp < injured.hp / injured.max_hp)) {
      injured = ally;
    }
  }
  if (injured) {
    change_target(injured);
  } else if (!alwaysFight &&
      ((playerStrength(strongestAlly) < playerStrength(strongestEnemy) ||
        fleeList.includes(strongestEnemy.name)) &&
      (!parent.next_transport || new Date() >= parent.next_transport || 
        character.ctype === 'rogue' && strongestEnemy.ctype === 'rogue') && 
      !fledSuccess() || enemies.length > allies.length ||
      (character.hp / character.max_hp < 0.5 && allies.length < 2))) {
    if (!can_move_to(nearestEnemy) && 
        parent.distance(character, nearestEnemy) > 500) {
      if (targets.target && party.includes(targets.target.name)) {
        change_target(targets.target);
      } else if (attackMonsterToggle && targets.target && 
          targets.target.type === 'monster') {
        change_target(targets.target);
        game_log('Careful! Nearby enemies: ' + enemies.map(function (e) {
          return e.name;
        }));
      }
    } else {
      flee(strongestEnemy);
      game_log('Fled from ' + enemies.map(function (e) {
        return e.name;
      }));
      if (character.invis) {
        set_message('Fled from ' + enemies.map(function (e) {
          return e.name;
        }));
      } else if (character.afk) {
        show_json('Fled from ' + enemies.map(function (e) {
          return e.name;
        }));
      }
    }
  } else {
    if (!nearestEnemy.invincible) {
      change_target(nearestEnemy);
    } else if (!strongestEnemy.invincible) {
      change_target(strongestEnemy);
    } else if (enemies.length > 2) {
      for (let enemy of enemies) {
        if (!enemy.invincible) {
          change_target(enemy);
        }
      }
    }
  }
}

function fledSuccess() {
  return character.map === 'jail';
}

function jail() {
  parent.socket.emit('transport', {to: 'jail'});
}
function flee(entity) {
  if (entity && entity.type === 'character') {
    strongEnemy = new Date();
  }
  if (character.ctype === 'rogue' && entity && entity.type === 'character' && 
      entity.ctype === 'rogue' && new Date() < parent.next_transport) {
    setTimeout(jail, parent.next_transport - new Date() + 10);
  } else if (!entity || entity.type === 'character' && 
        entity.ctype === 'rogue' || 
      character.ctype !== 'rogue' || parent.next_skill.invis && 
      new Date() < parent.next_skill.invis) {
    jail();
  } else if (entity.dead || entity.rip) {
    return;
  }
  if (character.ctype === 'rogue' && (!parent.next_skill.invis || 
      new Date() > parent.next_skill.invis)) {
    invis();
  }
}

function attackPlayer(player) {
  if (alwaysAttackTargeted === 1) return;
  set_message('Attacking ' + player.name);
  var distParams = canRangeMove(player);
  if (!in_attack_range(player) && 
      (character.range <= 50 || player.range >= 50 ||
        character.speed >= player.speed)) {
    if (distParams.canMove || can_move_to(player)) {
      if (character.ctype === 'warrior') {
        charge();
      }
      rangeMove(distParams.dist, distParams.theta, false, true);
    } else if (!currentPath || currentPath.length === 0) {
      currentPath = pathfind(player.real_x, player.real_y);
    }
  } else if (!player.rip) {
    rangeMove(distParams.dist, distParams.theta, 
              character.range > player.range, true);
  }
}

function attackMonster(target) {
  if (Math.hypot(character.real_x - lastPos[0], character.real_y - lastPos[1]) >
      returnDistance && character.map === lastMap && character.afk) {
    pathBack();
  }
  var distParams = canRangeMove(target);
  if (!target || target.dead) {
    set_message('No monsters');
  } else {
    set_message('Attacking ' + target.mtype);
    if (!distParams.canMove && !can_move_to(target) && 
        !in_attack_range(target)) {
      if ((!currentPath || currentPath.length === 0) && pathfindTo) {
        currentPath = pathfind(target.real_x, target.real_y);
      }
    } else if (target && !target.dead && !target.rip) {
      clearPath();
      rangeMove(distParams.dist, distParams.theta, 
                priorityMonsters.includes(target.mtype) && solo && 
                  character.range > 50);
    }
  }
}

function healPlayer(player) {
  set_message('Healing ' + player.name);
  var distParams = canRangeMove(player);
  if (!distParams.canMove && !can_move_to(player) && !in_attack_range(player)) {
    if (!currentPath || currentPath.length === 0) {
      currentPath = pathfind(player.real_x, player.real_y);
    }
  } else if (player && !player.dead && !player.rip && 
      !in_attack_range(player)) {
    rangeMove(distParams.dist, distParams.theta);
  }
}

function attackLoop() {
  var t = get_target();
  if (!t || t.dead || t.rip || 
      character.invis && (strongEnemy && new Date() - strongEnemy <= 60000 && 
        (!parent.next_transport || new Date() >= parent.next_transport) ||
      character.max_hp - character.hp > useHP) || alwaysAttackTargeted === 1) {
    return;
  }
  if (t && party.includes(t.name) && character.ctype === 'priest' && 
      in_attack_range(t)) {
    if (t.hp / t.max_hp <= healAt) {
      heal(t);
    }
  } else if (t && !t.dead && !t.rip && in_attack_range(t) && 
      !party.includes(t.name)) {
    attack(t);
  }
}

function useAbilityOn(target) {
  if (!target || target.dead || target.rip) {
    return;
  } else if (character.ctype === 'rogue') {
    invis();
  } else if (character.ctype === 'warrior') {
    taunt(target);
  } else if (character.ctype === 'ranger' && 
      (target.type === 'monster' || in_attack_range(target) && 
      target.hp <= (1 - target.armor / 1000) * character.attack * 2.5 ||
      target.hp <= (1 - target.armor / 1000) * character.attack * 1.5)) {
    supershot(target);
  } else if (character.ctype === 'priest') {
    curse(target);
  } else if (character.ctype === 'mage') {
    burst(target);
  }
}

function curse(target) {
  if ((!parent.next_skill.curse || 
      new Date() > parent.next_skill.curse) && !target.cursed) {
    lastcurse = new Date();
    parent.socket.emit("ability", {
      name: "curse",
      id: target.id
    });
  }
}

function invis() {
  if (!character.invis && (!parent.next_skill.invis ||
      new Date() > parent.next_skill.invis)) {
    parent.socket.emit("ability", {
      name: "invis"
    });
    character.invis = true;
  }
}

function burst(target) {
  if (!parent.next_skill.burst || new Date() > parent.next_skill.burst) {
    lastburst = new Date();
    parent.socket.emit("ability", {
      name: "burst",
      id: target.id
    });
  }
}

function supershot(target) {
  if ((!parent.next_skill.supershot || 
      new Date() > parent.next_skill.supershot) && character.mp >= 400) {
    parent.socket.emit("ability", {
      name: "supershot",
      id: target.id
    });
  }
}

function taunt(target) {
  if ((!parent.next_skill.taunt || new Date() > parent.next_skill.taunt) && 
      !target.taunted) {
    lasttaunt = new Date();
    parent.socket.emit("ability", {
      name: "taunt",
      id: target.id
    });
  }
}

function charge() {
  if (!parent.next_skill.charge || new Date() > parent.next_skill.charge) {
    lastcharge = new Date();
    parent.socket.emit("ability", {
      name: "charge"
    });
  }
}

function equipShield() {
  if (!character.slots['offhand'] ||
      character.slots['offhand'].name !== 'shield') {
    if (keyItems.shield.length && !shieldEquipped) {
      equip(keyItems.shield.reduce(function (prev, curr) {
        return prev.level > curr.level ? prev : curr;
      }).index);
    }
    shieldEquipped = true;
  }
}

function equipBlade() {
  if (character.slots['offhand'] && 
      character.slots['offhand'].name === 'shield' && shieldEquipped) {
    parent.socket.emit('unequip', {slot: 'offhand'});
    if (keyItems.blade.length) {
      equip(keyItems.blade.reduce(function (prev, curr) {
        return prev.level > curr.level ? prev : curr;
      }).index);
    }
    shieldEquipped = false;
  }
}

function equipLoop() {
  if (keyItems.shield && keyItems.shield.length || character.slots['offhand'] &&
      character.slots['offhand'].name === 'shield') {
    var t = get_target();
    if (!t || t.dead || t.rip || party.includes(t) || character.rip) {
      equipShield();
    } else if (!parent.next_attack || parent.next_attack - new Date() <= 250 && 
      in_attack_range(t)) {
      equipBlade();
    } else if (parent.next_attack && parent.next_attack - new Date() > 50) {
      equipShield();
    }
  }
}

function chainMove(xs, ys) {
  var xIdx = xs.indexOf(character.real_x);
  var yIdx = ys.indexOf(character.real_y);
  if (xIdx !== -1 && yIdx !== -1 && xIdx < xs.length - 1 && 
      yIdx < ys.length - 1 && xIdx === yIdx) {
    move(xs[xIdx + 1], ys[yIdx + 1]);
  }
}

var leftSuccess = false;
function tpBack() {
  if (!goBack || character.invis || parent.next_skill.invis && 
      new Date() < parent.next_skill.invis) return;
  if (fledSuccess() && 
      (!strongEnemy || new Date() - strongEnemy > 60000)) {
    attackMonsterToggle = false;
    parent.socket.emit('leave');
    leftSuccess = true;
  }
  if (leftSuccess) {
    pathBack();
    leftSuccess = false;
  }
}

function pathBack() {
  if (!spawnPath || character.map === lastMap && 
    character.real_x === lastPos[0] && character.real_y === lastPos[1]) return;
  attackMonsterToggle = false;
  if (character.map !== lastMap) {
    parent.socket.emit('transport', {to: lastMap});
    currentPath = spawnPath.slice();
  } else if (character.real_x === get_map().spawns[0][0] &&
      character.real_y === get_map().spawns[0][1]) {
    currentPath = spawnPath.slice();
  } else {
    if (can_move_to(lastPos[0], lastPos[1])) {
      currentPath = [{x: lastPos[0], y: lastPos[1]}];
    } else {
      currentPath = pathfind(lastPos[0], lastPos[1]);
    }
  }
}

var currentPoint;
function pathfindMove() {
  if (!overrideAMT && (!currentPath || !currentPath.length) && (!currentPoint ||
      character.real_x === currentPoint.x && 
      character.real_y === currentPoint.y) && !attackMonsterToggle) {
    attackMonsterToggle = true;
    clearPath();
  }
  if (!currentPath || !currentPath.length) {
    return;
  }
  if (can_move_to(currentPath[0].x, currentPath[0].y)) {
    currentPoint = currentPath.shift();
    move(currentPoint.x, currentPoint.y);
  } else if (currentPoint && (character.going_x !== currentPoint.x && 
      character.going_y !== currentPoint.y && 
        can_move_to(currentPoint.x, currentPoint.y) || !character.moving)) {
    move(currentPoint.x, currentPoint.y);
  } else if (!can_move_to(currentPath[0].x, currentPath[0].y) &&
      currentPoint && (character.going_x !== currentPoint.x && 
      character.going_y !== currentPoint.y && 
      !can_move_to(currentPoint.x, currentPoint.y))) {
    clearPath();
  }
}

var currentMap;
var graph;
var currentPath;
function pathfind(x, y, x2, y2) {
  if (!currentMap || currentMap !== character.map) {
    currentMap = character.map;
    graph = initialize_graph(character.map);
  }
  var from, to, path;
  if (x2 == null || y2 == null) {
    from = graph.get(character.real_x, character.real_y);
    to = graph.get(x, y);
  } else {
    from = graph.get(x, y);
    to = graph.get(x2, y2);
  }
  try {
    path = find_path(from, to);
  } catch (e) {
    path = null;
  }
  return path;
}

function clearPath() {
  currentPath = null;
  currentPoint = null;
}

function targets() {
  if (character.rip) return;
  searchInv();
  uceItem();
  potions();
  loopAddition();
  if (!doAttack) return;
  var target = get_target();
  if (target && (target.dead || target.rip)) {
    target = null;
    parent.ctarget = null;
  }
  if (alwaysAttackTargeted === 1) return;
  var t = searchTargets(maxMonsterHP, minMonsterXP, target);
  if (t && t.players) {
    doPVP(t);
    t = get_target();
  } else {
    change_target(t);
  }
  if (t && t.type === 'character' && !party.includes(t.name) ||
      t && t.type === 'monster' && (useAbilities === true ||
      useAbilities !== false && useAbilities <= t.max_hp)) {
    useAbilityOn(t);
  }
}

function main() { // move and attack code
  if (character.rip) return;
  loot();
  if (character.invis && strongEnemy && 
      new Date() - strongEnemy < 60000) return;
  if (fledSuccess() && 
      strongEnemy && new Date() - strongEnemy >= 60000 &&
      character.invis) {
    let t = get_nearest_monster();
    change_target(t);
  } else if (character.max_hp - character.hp <= useHP) {
    tpBack();
  }
  pathfindMove();
  if (!doAttack) return;
  var target = get_target();
  if ((!target || !in_attack_range(target)) && pocket && get_player(pocket) &&
      !pocket.rip) {
    var p = get_player(pocket);
    move(p.real_x, p.real_y);
  }
  if (target && target.type === 'character' && 
      character.ctype === 'priest' && party.includes(target.name)) {
    healPlayer(target);
  } else if (parent.pvp && target && target.type === 'character' &&
      !party.includes(target.name)) {
    attackPlayer(target);
  } else if (attackMonsterToggle) {
    attackMonster(target);
  }
}

setCorrectingInterval(attackLoop, 1000 / character.frequency + attackLoopDelay);
setCorrectingInterval(main, 250);
setCorrectingInterval(targets, 100);
if (character.ctype === 'warrior') {
  keyItems['shield'] = [];
  keyItems['blade'] = [];
  var shieldEquipped = character.slots['offhand'] && 
    character.slots['offhand'].name === 'shield';
  setCorrectingInterval(equipLoop, 100);
}
