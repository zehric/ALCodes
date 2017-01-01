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
  spawnPath = [{x: sx, y: sy}];
} else {
  spawnPath = pathfind(get_map().spawns[0][0], get_map().spawns[0][1],
    character.real_x, character.real_y);
}

var attackMonsterToggle = true;
var alwaysAttackTargeted = false;
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
  } else if (e.keyCode === 16) {
    parent.render_transports_npc();
  } else if (e.keyCode === 192) {
    goBack = false;
    game_log('Auto TP Back Disabled. Reenable with -');
    parent.socket.emit('transport', {to: 'jail'});
  } else if (e.keyCode === 221) {
    attackMonsterToggle = !attackMonsterToggle;
    game_log('Attack monsters: ' + attackMonsterToggle);
    set_message('Attack monsters: ' + attackMonsterToggle);
  } else if (e.keyCode === 219) {
    kite = !kite;
  } else if (e.keyCode === 187) {
    alwaysAttackTargeted = !alwaysAttackTargeted;
    game_log('Manual Targeting: ' + alwaysAttackTargeted);
    set_message('Manual Targeting: ' + alwaysAttackTargeted);
  } else if (e.keyCode === 189) {
    goBack = !goBack;
    game_log('Auto TP Back: ' + goBack);
  } else if (e.keyCode === 40) {
    lastPos = [character.real_x, character.real_y];
    lastMap = character.map;
    spawnPath = pathfind(get_map().spawns[0][0], get_map().spawns[0][1],
      character.real_x, character.real_y);
    game_log('Saved current location. Come back here with up arrow.');
  } else if (e.keyCode === 38) {
    pathBack();
  }
}

parent.window.addEventListener('keydown', keybindings);

on_destroy = function () {
  parent.window.removeEventListener('keydown', keybindings);
};

parent.map.on('mousedown', function () {
  currentPath = null;
  currentPoint = null;
});

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
    let g = G.items[name].g
    if (upgradeItems[name] && buyable.includes(name) && 
        (!keyItems[name] || !keyItems[name].length) && character.gold >= g) {
      buy(name, 1)
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
      let correctScroll = 'scroll' + item_grade(character.items[index]);
      if (keyItems[correctScroll] && keyItems[correctScroll].length && 
          keyItems[correctScroll][0].q >= 1) {
        upgrade(index, keyItems[correctScroll][0].index);
        keyItems[correctScroll][0].q -= 1;
      } else if (character.gold >= G.items[correctScroll].g) {
        buy(correctScroll, 1);
        character.gold -= G.items[correctScroll].g
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
            character.gold -= G.items[correctCScroll].g
          }
        }
      }
    } else if (G.items[name].e && G.items[name].e <= itemArr[0].q) {
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
  var vc = character.speed;
  var vt = target.speed;
  var d = vec.length - character.range;
  if (target.moving) {
    rangeAdjust = (vc * vt * Math.cos(phi) * (0.1 + 
      d / vc)) / (vc + vt * Math.abs(Math.cos(phi)));
  } else {
    rangeAdjust = 0;
  }
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
  if (isPVP && character.range <= 50 || character.range <= 50 && dist > 0) {
    move(character.real_x + (dist + character.range) * Math.cos(theta),
         character.real_y + (dist + character.range) * Math.sin(theta));
  } else if (dist > 0) {
    currentPath = null;
    currentPoint = null;
    move(newX, newY);
  } else if ((kite || forceKite) && 
      (!lastAdjust || new Date() - lastAdjust > 300)) {
    currentPath = null;
    currentPoint = null;
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
             (dist - wkr / 63 * Math.ceil(counter / 2)) * Math.cos(theta);
      newY = character.real_y +
             (dist - wkr / 63 * Math.ceil(counter / 2)) * Math.sin(theta);
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
    currentPath = null;
    currentPoint = null;
    move(character.real_x + dist * Math.cos(lastTheta),
         character.real_y + dist * Math.sin(lastTheta));
  }
}

function searchTargets(maxHP, minXP, currentTarget) {
  if (currentTarget && !party.includes(currentTarget.name) && !parent.pvp &&
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
        !current.npc) {
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
        !party.includes(target.name))) {
      if (tanks.includes(current.target) || solo) {
        target = current;
      } else {
        continue;
      }
    }
    var cx = current.real_x, cy = current.real_y;
    if ((!target || target.type !== 'character') &&
        (!current.target || party.includes(current.target)) &&
        current.type === 'monster' && !current.dead && 
        parent.distance(character, current) <= maxMonsterDistance &&
        (!xBoundaries.length || cx >= xBoundaries[0] && cy <= xBoundaries[1]) &&
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
    if (currentTarget && !party.includes(currentTarget.name) &&
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
        G.items[name].e || G.items[name].scroll) { 
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
  if (t && !t.dead && !t.rip && t.type === 'character' && 
      !party.includes(t.name)) {
    if (keyItems.hpot1.length === 0) {
      buy('hpot1', 2);
    } else if (keyItems.hpot1.length === 1 && keyItems.hpot1[0].q < 2) {
      buy('hpot1', 1);
    }
    if (keyItems.mpot1.length === 0) {
      buy('mpot1', 2);
    } else if (keyItems.mpot1.length === 1 && keyItems.mpot1[0].q < 2) {
      buy('mpot1', 1);
    }
    if (character.mp < character.mp_cost + 50 && 
        new Date() > parent.next_potion && keyItems.mpot1.length) {
      use(keyItems.mpot1[0].index);
    } else if (character.hp < character.max_hp - 250 && 
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
  var strongestEnemy = nearestEnemy = enemies[0];
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
    healPlayer(injured);
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
        healPlayer(targets.target);
      } else if (attackMonsterToggle && targets.target && 
          targets.target.type === 'monster') {
        attackMonster(targets.target);
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
      attackPlayer(nearestEnemy);
    } else if (!strongestEnemy.invincible) {
      attackPlayer(strongestEnemy);
    } else if (enemies.length > 2) {
      for (let enemy of enemies) {
        if (!enemy.invincible) {
          attackPlayer(enemy);
        }
      }
    }
  }
}

function fledSuccess() {
  return character.map === 'jail';
}

function tp() {
  parent.socket.emit('transport', {to: 'jail'});
}
function flee(entity) {
  if (entity && entity.type === 'character') {
    strongEnemy = new Date();
  }
  if (character.ctype === 'rogue' && entity && entity.type === 'character' && 
      entity.ctype === 'rogue' && new Date() < parent.next_transport) {
    setTimeout(tp, parent.next_transport - new Date() + 10);
  } else if (!entity || entity.type === 'character' && 
        entity.ctype === 'rogue' || 
      character.ctype !== 'rogue' || parent.next_skill.invis && 
      new Date() < parent.next_skill.invis) {
    tp();
  } else if (entity.dead || entity.rip) {
    return;
  }
  if (character.ctype === 'rogue' && (!parent.next_skill.invis || 
      new Date() > parent.next_skill.invis)) {
    invis();
  }
}

function attackPlayer(player) {
  set_message('Attacking ' + player.name);
  change_target(player);
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
  var distParams = canRangeMove(target);
  if (!target || target.dead) {
    set_message('No monsters');
    pathBack();
  } else {
    set_message('Attacking ' + target.mtype);
    change_target(target);
    if (!distParams.canMove && !can_move_to(target) && 
        !in_attack_range(target)) {
      if (!currentPath || currentPath.length === 0) {
        currentPath = pathfind(target.real_x, target.real_y);
      }
    } else if (target && !target.dead && !target.rip) {
      currentPath = null;
      currentPoint = null;
      rangeMove(distParams.dist, distParams.theta, 
                priorityMonsters.includes(target.mtype) && solo && 
                  character.range > 50);
    }
  }
}

function healPlayer(player) {
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
  spawnPath = [{x: sx, y: sy}];
} else {
  spawnPath = pathfind(get_map().spawns[0][0], get_map().spawns[0][1],
    character.real_x, character.real_y);
}

var attackMonsterToggle = true;
var alwaysAttackTargeted = false;
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
  } else if (e.keyCode === 16) {
    parent.render_transports_npc();
  } else if (e.keyCode === 192) {
    goBack = false;
    game_log('Auto TP Back Disabled. Reenable with -');
    parent.socket.emit('transport', {to: 'jail'});
  } else if (e.keyCode === 221) {
    attackMonsterToggle = !attackMonsterToggle;
    game_log('Attack monsters: ' + attackMonsterToggle);
    set_message('Attack monsters: ' + attackMonsterToggle);
  } else if (e.keyCode === 219) {
    kite = !kite;
  } else if (e.keyCode === 187) {
    alwaysAttackTargeted = !alwaysAttackTargeted;
    game_log('Manual Targeting: ' + alwaysAttackTargeted);
    set_message('Manual Targeting: ' + alwaysAttackTargeted);
  } else if (e.keyCode === 189) {
    goBack = !goBack;
    game_log('Auto TP Back: ' + goBack);
  } else if (e.keyCode === 40) {
    lastPos = [character.real_x, character.real_y];
    lastMap = character.map;
    spawnPath = pathfind(get_map().spawns[0][0], get_map().spawns[0][1],
      character.real_x, character.real_y);
    game_log('Saved current location. Come back here with up arrow.');
  } else if (e.keyCode === 38) {
    pathBack();
  }
}

parent.window.addEventListener('keydown', keybindings);

on_destroy = function () {
  parent.window.removeEventListener('keydown', keybindings);
};

parent.map.on('mousedown', function () {
  currentPath = null;
  currentPoint = null;
});

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
    let g = G.items[name].g
    if (upgradeItems[name] && buyable.includes(name) && 
        (!keyItems[name] || !keyItems[name].length) && character.gold >= g) {
      buy(name, 1)
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
      let correctScroll = 'scroll' + item_grade(character.items[index]);
      if (keyItems[correctScroll] && keyItems[correctScroll].length && 
          keyItems[correctScroll][0].q >= 1) {
        upgrade(index, keyItems[correctScroll][0].index);
        keyItems[correctScroll][0].q -= 1;
      } else if (character.gold >= G.items[correctScroll].g) {
        buy(correctScroll, 1);
        character.gold -= G.items[correctScroll].g
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
            character.gold -= G.items[correctCScroll].g
          }
        }
      }
    } else if (G.items[name].e && G.items[name].e <= itemArr[0].q) {
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
  var vc = character.speed;
  var vt = target.speed;
  var d = vec.length - character.range;
  if (target.moving) {
    rangeAdjust = (vc * vt * Math.cos(phi) * (0.1 + 
      d / vc)) / (vc + vt * Math.abs(Math.cos(phi)));
  } else {
    rangeAdjust = 0;
  }
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
  if (isPVP && character.range <= 50 || character.range <= 50 && dist > 0) {
    move(character.real_x + (dist + character.range) * Math.cos(theta),
         character.real_y + (dist + character.range) * Math.sin(theta));
  } else if (dist > 0) {
    currentPath = null;
    currentPoint = null;
    move(newX, newY);
  } else if ((kite || forceKite) && 
      (!lastAdjust || new Date() - lastAdjust > 300)) {
    currentPath = null;
    currentPoint = null;
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
             (dist - wkr / 63 * Math.ceil(counter / 2)) * Math.cos(theta);
      newY = character.real_y +
             (dist - wkr / 63 * Math.ceil(counter / 2)) * Math.sin(theta);
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
    currentPath = null;
    currentPoint = null;
    move(character.real_x + dist * Math.cos(lastTheta),
         character.real_y + dist * Math.sin(lastTheta));
  }
}

function searchTargets(maxHP, minXP, currentTarget) {
  if (currentTarget && !party.includes(currentTarget.name) && !parent.pvp &&
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
        !current.npc) {
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
        !party.includes(target.name))) {
      if (tanks.includes(current.target) || solo) {
        target = current;
      } else {
        continue;
      }
    }
    var cx = current.real_x, cy = current.real_y;
    if ((!target || target.type !== 'character') &&
        (!current.target || party.includes(current.target)) &&
        current.type === 'monster' && !current.dead && 
        parent.distance(character, current) <= maxMonsterDistance &&
        (!xBoundaries.length || cx >= xBoundaries[0] && cy <= xBoundaries[1]) &&
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
    if (currentTarget && !party.includes(currentTarget.name) &&
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
        G.items[name].e || G.items[name].scroll) { 
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
  if (t && !t.dead && !t.rip && t.type === 'character' && 
      !party.includes(t.name)) {
    if (keyItems.hpot1.length === 0) {
      buy('hpot1', 2);
    } else if (keyItems.hpot1.length === 1 && keyItems.hpot1[0].q < 2) {
      buy('hpot1', 1);
    }
    if (keyItems.mpot1.length === 0) {
      buy('mpot1', 2);
    } else if (keyItems.mpot1.length === 1 && keyItems.mpot1[0].q < 2) {
      buy('mpot1', 1);
    }
    if (character.mp < character.mp_cost + 50 && 
        new Date() > parent.next_potion && keyItems.mpot1.length) {
      use(keyItems.mpot1[0].index);
    } else if (character.hp < character.max_hp - 250 && 
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
  var strongestEnemy = nearestEnemy = enemies[0];
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
    healPlayer(injured);
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
        healPlayer(targets.target);
      } else if (attackMonsterToggle && targets.target && 
          targets.target.type === 'monster') {
        attackMonster(targets.target);
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
      attackPlayer(nearestEnemy);
    } else if (!strongestEnemy.invincible) {
      attackPlayer(strongestEnemy);
    } else if (enemies.length > 2) {
      for (let enemy of enemies) {
        if (!enemy.invincible) {
          attackPlayer(enemy);
        }
      }
    }
  }
}

function fledSuccess() {
  return character.map === 'jail';
}

function tp() {
  parent.socket.emit('transport', {to: 'jail'});
}
function flee(entity) {
  if (entity && entity.type === 'character') {
    strongEnemy = new Date();
  }
  if (character.ctype === 'rogue' && entity && entity.type === 'character' && 
      entity.ctype === 'rogue' && new Date() < parent.next_transport) {
    setTimeout(tp, parent.next_transport - new Date() + 10);
  } else if (!entity || entity.type === 'character' && 
        entity.ctype === 'rogue' || 
      character.ctype !== 'rogue' || parent.next_skill.invis && 
      new Date() < parent.next_skill.invis) {
    tp();
  } else if (entity.dead || entity.rip) {
    return;
  }
  if (character.ctype === 'rogue' && (!parent.next_skill.invis || 
      new Date() > parent.next_skill.invis)) {
    invis();
  }
}

function attackPlayer(player) {
  set_message('Attacking ' + player.name);
  change_target(player);
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
  var distParams = canRangeMove(target);
  if (!target || target.dead) {
    set_message('No monsters');
    pathBack();
  } else {
    set_message('Attacking ' + target.mtype);
    change_target(target);
    if (!distParams.canMove && !can_move_to(target) && 
        !in_attack_range(target)) {
      if (!currentPath || currentPath.length === 0) {
        currentPath = pathfind(target.real_x, target.real_y);
      }
    } else if (target && !target.dead && !target.rip) {
      currentPath = null;
      currentPoint = null;
      rangeMove(distParams.dist, distParams.theta, 
                priorityMonsters.includes(target.mtype) && solo && 
                  character.range > 50);
    }
  }
}

function healPlayer(player) {
  set_message('Healing ' + player.name);
  change_target(player);
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
      character.max_hp - character.hp > useHP)) {
    return;
  }
  if (t && t.type === 'character' && !party.includes(t.name) ||
      t && t.type === 'monster' && (useAbilities === true ||
        useAbilities !== false && useAbilities <= t.max_hp)) {
    useAbilityOn(t);
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
  } else if (character.ctype === 'ranger' && (target.type === 'monster' ||
      target.hp < (1 - target.armor / 1000) * character.attack * 2.5)) {
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
    buy('mpot1', 1);
    parent.socket.emit("ability", {
      name: "burst",
      id: target.id
    });
  }
}

function supershot(target) {
  if ((!parent.next_skill.supershot || 
      new Date() > parent.next_skill.supershot) && character.mp >= 400) {
    buy('mpot0', 1);
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
    if (keyItems.shield.length) {
      equip(keyItems.shield.reduce(function (prev, curr) {
        return prev.level > curr.level ? prev : curr;
      }).index);
    }
  }
}

function equipWeapon() {
  if (character.slots['offhand'] !== null && 
      character.slots['offhand'].name === 'shield') {
    parent.socket.emit('unequip', {slot: 'offhand'});
  } else if (character.slots['offhand'] === null) {
    if (keyItems.blade.length) {
      equip(keyItems.blade.reduce(function (prev, curr) {
        return prev.level > curr.level ? prev : curr;
      }).index);
    }
  }
}

function equipLoop() {
  var t = get_target();
  if (!t || t.dead || t.rip || party.includes(t) || character.rip) return;
  if (!parent.next_attack || parent.next_attack - new Date() <= 400 && 
      in_attack_range(t)) {
    equipWeapon();
  } else {
    equipShield();
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
    parent.socket.emit('leave');
    leftSuccess = true;
  }
  if (leftSuccess) {
    pathBack();
    leftSuccess = false;
  }
  // if (leftSuccess) {
  //   parent.socket.emit('transport', {to: lastMap});
  // }
  // if (leftSuccess && character.map === lastMap) {
  //   var x = lastPos[0], y = lastPos[1];
  //   if (can_move_to(x, y)) {
  //     move(x, y)
  //   } else {
  //     currentPath = pathfind(x, y);
  //   }
  //   leftSuccess = false;
  // }
}

var ignore = false;
function pathBack() {
  if (!spawnPath) return;
  ignore = true;
  if (character.map !== lastMap) {
    parent.socket.emit('transport', {to: lastMap});
    currentPath = spawnPath.slice();
  } else if (character.real_x === get_map().spawns[0][0] &&
      character.real_y === get_map().spawns[0][1]) {
    currentPath = spawnPath.slice();
  } else {
    if (can_move_to(lastPos[0], lastPos[1])) {
      move(lastPos[0], lastPos[1]);
    } else {
      currentPath = pathfind(lastPos[0], lastPos[1]);
    }
  }
}

var currentPoint;
function pathfindMove() {
  if (ignore && Math.hypot(lastPos[1] - character.real_y, 
      lastPos[0] - character.real_x) < 50) {
    attackMonsterToggle = true;
    ignore = false;
    currentPoint = null;
  } else if (ignore) {
    attackMonsterToggle = false;
  }
  if (!currentPath || !currentPath.length) {
    return;
  }
  if (can_move_to(currentPath[0].x, currentPath[0].y)) {
    currentPoint = currentPath.shift();
    move(currentPoint.x, currentPoint.y);
  } else if (currentPoint && (character.going_x !== currentPoint.x && 
      character.going_y !== currentPoint.y || !character.moving)) {
    move(currentPoint.x, currentPoint.y);
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

function main() { // move and attack code
  if (character.rip) return;
  loot();
  searchInv();
  uceItem();
  potions();
  loopAddition();
  if (!doAttack) return;
  if (character.invis && strongEnemy && 
      new Date() - strongEnemy < 60000) return;
  if (fledSuccess() && 
      strongEnemy && new Date() - strongEnemy >= 60000 &&
      character.invis) {
    attackMonster(get_nearest_monster());
  } else if (character.max_hp - character.hp <= useHP){
    tpBack();
  }
  pathfindMove();
  var target = get_target();
  if (target && (target.dead || target.rip)) {
    target = null;
    parent.ctarget = null;
  }
  target = searchTargets(maxMonsterHP, minMonsterXP, target);
  if ((!target || !in_attack_range(target)) && pocket && get_player(pocket) &&
      !pocket.rip) {
    var p = get_player(pocket);
    move(p.real_x, p.real_y);
  }
  if (target && target.players) {
    doPVP(target);
  } else if (target && target.type === 'character' && 
      party.includes(target.name)) {
    healPlayer(target);
  } else if (parent.pvp && target && target.type === 'character') {
    attackPlayer(target);
  } else if (attackMonsterToggle) {
    attackMonster(target);
  }
}

setCorrectingInterval(attackLoop, 1000 / character.frequency + attackLoopDelay);
setCorrectingInterval(main, loopInterval);
if (character.ctype === 'warrior') {
  keyItems[shield] = [];
  keyItems[blade] = [];
  setCorrectingInterval(equipLoop, 100);
}
  set_message('Healing ' + player.name);
  change_target(player);
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
      character.max_hp - character.hp > useHP)) {
    return;
  }
  if (t && t.type === 'character' && !party.includes(t.name) ||
      t && t.type === 'monster' && (useAbilities === true ||
        useAbilities !== false && useAbilities <= t.max_hp)) {
    useAbilityOn(t);
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
  } else if (character.ctype === 'ranger' && (target.type === 'monster' ||
      target.hp < (1 - target.armor / 1000) * character.attack * 2.5)) {
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
    buy('mpot1', 1);
    parent.socket.emit("ability", {
      name: "burst",
      id: target.id
    });
  }
}

function supershot(target) {
  if ((!parent.next_skill.supershot || 
      new Date() > parent.next_skill.supershot) && character.mp >= 400) {
    buy('mpot0', 1);
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
    if (keyItems.shield.length) {
      equip(keyItems.shield.reduce(function (prev, curr) {
        return prev.level > curr.level ? prev : curr;
      }).index);
    }
  }
}

function equipWeapon() {
  if (character.slots['offhand'] !== null && 
      character.slots['offhand'].name === 'shield') {
    parent.socket.emit('unequip', {slot: 'offhand'});
  } else if (character.slots['offhand'] === null) {
    if (keyItems.blade.length) {
      equip(keyItems.blade.reduce(function (prev, curr) {
        return prev.level > curr.level ? prev : curr;
      }).index);
    }
  }
}

function equipLoop() {
  var t = get_target();
  if (!t || t.dead || t.rip || party.includes(t) || character.rip) return;
  if (!parent.next_attack || parent.next_attack - new Date() <= 400 && 
      in_attack_range(t)) {
    equipWeapon();
  } else {
    equipShield();
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
  if (fledSuccess() && lastMap && 
      (!strongEnemy || new Date() - strongEnemy > 60000)) {
    parent.socket.emit('leave');
    leftSuccess = true;
  }
  if (leftSuccess) {
    pathBack();
    leftSuccess = false;
  }
  // if (leftSuccess) {
  //   parent.socket.emit('transport', {to: lastMap});
  // }
  // if (leftSuccess && character.map === lastMap) {
  //   var x = lastPos[0], y = lastPos[1];
  //   if (can_move_to(x, y)) {
  //     move(x, y)
  //   } else {
  //     currentPath = pathfind(x, y);
  //   }
  //   leftSuccess = false;
  // }
}

var ignore = false;
function pathBack() {
  if (!spawnPath) return;
  ignore = true;
  if (character.map !== lastMap) {
    parent.socket.emit('transport', {to: lastMap});
    currentPath = spawnPath.slice();
  } else if (character.real_x === get_map().spawns[0][0] &&
      character.real_y === get_map().spawns[0][1]) {
    currentPath = spawnPath.slice();
  } else {
    if (can_move_to(lastPos[0], lastPos[1])) {
      move(lastPos[0], lastPos[1]);
    } else {
      currentPath = pathfind(lastPos[0], lastPos[1]);
    }
  }
}

var currentPoint;
function pathfindMove() {
  if (ignore && Math.hypot(lastPos[1] - character.real_y, 
      lastPos[0] - character.real_x) < 50) {
    attackMonsterToggle = true;
    ignore = false;
    currentPoint = null;
  } else if (ignore) {
    attackMonsterToggle = false;
  }
  if (!currentPath || !currentPath.length) {
    return;
  }
  if (can_move_to(currentPath[0].x, currentPath[0].y)) {
    currentPoint = currentPath.shift();
    move(currentPoint.x, currentPoint.y);
  } else if (currentPoint && (character.going_x !== currentPoint.x && 
      character.going_y !== currentPoint.y || !character.moving)) {
    move(currentPoint.x, currentPoint.y);
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

function main() { // move and attack code
  if (character.rip) return;
  loot();
  searchInv();
  uceItem();
  potions();
  loopAddition();
  if (!doAttack) return;
  if (character.invis && strongEnemy && 
      new Date() - strongEnemy < 60000) return;
  if (fledSuccess() && 
      strongEnemy && new Date() - strongEnemy >= 60000 &&
      character.invis) {
    attackMonster(get_nearest_monster());
  } else if (character.max_hp - character.hp <= useHP){
    tpBack();
  }
  pathfindMove();
  var target = get_target();
  if (target && (target.dead || target.rip)) {
    target = null;
    parent.ctarget = null;
  }
  target = searchTargets(maxMonsterHP, minMonsterXP, target);
  if ((!target || !in_attack_range(target)) && pocket && get_player(pocket) &&
      !pocket.rip) {
    var p = get_player(pocket);
    move(p.real_x, p.real_y);
  }
  if (target && target.players) {
    doPVP(target);
  } else if (target && target.type === 'character' && 
      party.includes(target.name)) {
    healPlayer(target);
  } else if (parent.pvp && target && target.type === 'character') {
    attackPlayer(target);
  } else if (attackMonsterToggle) {
    attackMonster(target);
  }
}

setCorrectingInterval(attackLoop, 1000 / character.frequency + attackLoopDelay);
setCorrectingInterval(main, loopInterval);
if (character.ctype === 'warrior') {
  keyItems[shield] = [];
  keyItems[blade] = [];
  setCorrectingInterval(equipLoop, 100);
}
