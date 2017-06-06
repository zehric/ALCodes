//Credit for correctingInterval goes to JourneyOver 'http://tiny.cc/MyFunctions'
window.setCorrectingInterval = (function(func, delay) {
  var instance = {};

  var tick = function (func, delay) {
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
var lastPos, lastMap, cs;
saveLoc();

var attackMonsterToggle = true;
var alwaysAttackTargeted = 0;
var overrideKite = false;
var journeying = false;

const part = [];
const merchName = 'Tool';

if (typeof(turretMode) === 'undefined') {
  var turretMode = false;
}
if (turretMode === true) {
  alwaysFight = true;
}

function keybindings(e) {
  if (parent.$("input:focus").length > 0 ||
      parent.$("textarea:focus").length > 0 ||
      e.target && e.target.hasAttribute("contenteditable")) {
    if (!(e.keyCode == 27 && window.character)) {
      return;
    }
  }
  if (e.keyCode === 113) {
    clearPath();
    journey('bank');
  } else if (e.keyCode === 16) {
    parent.render_transports_npc();
  } else if (e.keyCode === 221) {
    if (get_targeted_monster()) parent.ctarget = null;
    clearPath();
    attackMonsterToggle = !attackMonsterToggle;
    game_log('Target monsters: ' + attackMonsterToggle);
  } else if (e.keyCode === 219) {
    alwaysFight = !alwaysFight;
    game_log('Always Fight: ' + alwaysFight);
  } else if (e.keyCode === 187) {
    if (!alwaysAttackTargeted) parent.ctarget = null;
    clearPath();
    alwaysAttackTargeted = (alwaysAttackTargeted + 1) % 3;
    game_log('Manual Targeting: ' + alwaysAttackTargeted);
  } else if (e.keyCode === 40) {
    saveLoc();
    game_log('Saved current location. Come back here with up arrow.');
  } else if (e.keyCode === 38) {
    pathBack();
  } else if (e.keyCode === 222) {
    overrideKite = !overrideKite;
    game_log('Stop CODE movement: ' + overrideKite);
  }
}

function saveLoc() {
  lastPos = [character.real_x, character.real_y];
  lastMap = character.map;
  cs = closestSpawn();
}

parent.window.addEventListener('keydown', keybindings);

on_destroy = function () {
  parent.window.removeEventListener('keydown', keybindings);
  parent.socket.removeListener('hit', hitSuccess);
  parent.socket.removeListener('disappearing_text', hitFailure);
};

parent.map.on('mousedown', function () {
  clearPath();
});

handle_death = function () {
  clearPath();
  return true;
};

function convertPath(draivin) {
  var notDraivin = [];
  for (let nt of draivin) {
    notDraivin.push({x: nt.x, y: nt.y});
  }
  return notDraivin;
}

handle_command = function (command, args) {
  if (args) {
    args = args.split(' ');
  } else {
    args = [];
  }
  if (command === 'tp') {
    if (args[0] in G.maps) {
      clearPath();
      journey(args[0]);
    } else {
      game_log('Map ' + args + ' not found.');
    }
  } else if (command === 'pathfind') {
    if (args.length === 2) {
      window.prompt("Copy to clipboard:", 
        JSON.stringify(convertPath(pathfind(Number(args[0]), 
          Number(args[1])))));
    } else {
      game_log('Usage: /pathfind X Y');
    }
  } else if (command === 'loc') {
    if (!args.length) {
      window.prompt("Copy to clipboard:", Math.floor(character.real_x) + ' ' +
        Math.floor(character.real_y));
    } else if (args.length === 1 && args[0] === 't' && parent.ctarget) {
      window.prompt("Copy to clipboard:", parent.ctarget.real_x + ' ' +
        parent.ctarget.real_y);
    }
  } else if (command === 'respawn') {
    part.forEach(function (name) {
      send_cm(name, {message: 'respawn'});
    });
  } else if (command === 'saveLoc') {
    if (args.length === 0) {
      part.forEach(function (name) {
        send_cm(name, {message: 'saveLoc'});
      });
    } else if (args.length === 1) {
      send_cm(args[0], {message: 'saveLoc'});
    }
  } else if (command === 'reload') {
    if (args.length === 0) {
      part.forEach(function (name) {
        send_cm(name, {message: 'reload'});
      });
    } else if (args.length === 1) {
      send_cm(args[0], {message: 'reload'});
    }
  } else if (command === 'follow') {
    send_cm('bleevl', {message: 'follow'});
  } else if (command === 'flush') {
    giveToMerch(true);
  } else if (command === 'info') {
    if (args.length === 1) {
      send_cm(args[0], {message: 'info'});
    }
  } else if (command === 'locate') {
    if (args.length === 1) {
      send_cm(args[0], {message: 'loc'});
    }
  } else if (command === 'retrieve') {
    if (args.length === 1) {
      send_cm(args[0], {message: '', r: true});
    } else if (args.length === 2) {
      send_cm(args[0], {message: args[1], r: true});
    } else if (args.length === 3) {
      send_cm(args[0], {message: args[1] + ' ' + args[2], r: true});
    }
  } else if (command === 'send') {
    if (args.length >= 1 && args.length <= 3) {
      if (Number(args[1]) || !args[1]) {
        send_gold(args[0], (Number(args[1]) || character.gold));
      } else {
        const index = Number(args[2]);
        if (args[1] === 'item' && index) {
          let item = character.items[index];
          if (item) {
            send_item(args[0], index, item.q);
          }
        } else {
          for (let i = character.items.length - 1; i >= 0; i--) {
            const item = character.items[i];
            if (item && item.name.includes(args[1])) {
              send_item(args[0], i, item.q);
            }
          }
        }
      }
    }
  }
};

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

on_disappear = function (entity, data) {
  if (pocket && entity.id === pocket && data.to) {
    parent.socket.emit('transport', {to: data.to, s: data.s});
    p = true;
  }
};

var priorityEnemy;
var merchJ = false;
on_cm = function (name, data) {
  if (!data) return;
  const r = data.r;
  data = data.message;
  if (party.includes(name) && data === 'respawn') {
    respawn();
    setTimeout(pathBack, 200);
  } else if (party.includes(name) && data === 'reload') {
    parent.api_call('load_code', {
      name: 1,
      run: true
    });
  } else if (party.includes(name) && data === 'saveLoc') {
    saveLoc();
  } else if (party.includes(name) && data === 'info') {
    parent.private_say(name, JSON.stringify(character.items));
  } else if (party.includes(name) && data === 'loc') {
    const x = Math.round(character.real_x);
    const y = Math.round(character.real_y);
    parent.private_say(name, "map: " + character.in + " x: " + x + " y: " + y);
  } else if (name === 'Glass' && r) {
    handle_command('send', 'Glass ' + data);
  } else if (character.name === 'bleevl' && party.includes(name) &&
      data === 'follow') {
    if (pocket === '') {
      pocket = 'Glass';
      attackMonsterToggle = false;
    } else {
      pocket = '';
      attackMonsterToggle = true;
    }
  } else if ((party.includes(name) || name === merchName) &&
      data === 'potions') {		
    let pots = 1665;
    let quant = 0;
    if (keyItems.mpot0.length) {
      for (let pot of keyItems.mpot0) {
        quant += pot.q;
      }
    }
    pots = 1665 - quant;
    if (pots > 0) {
      send_cm(merchName, {message: 'potions', q: pots});
    }
    merchJ = true;
  } else if (name === merchName && data === 'done') {
    merchJ = false;
  } else if (party.includes(name) && !party.includes(data)) {
    priorityEnemy = data;
    receivedCM = true;
  }
};

if (!character.party) {
  for (let person of party) {
    parent.socket.emit('party', {event: 'request', name: person});
  }
}

for (let person of party) {
  if ((!character.party || parent.party_list.length < 6) &&
      !parent.party_list.includes(person)) {
    parent.socket.emit('party', {event: 'invite', name: person});
  }
}

function inTown() {
  const x = character.real_x, y = character.real_y;
  return character.in === 'main' && x > -300 && y > -185 && x < -120 && y < -50;
}

var buyable = ['coat', 'gloves', 'helmet', 'bow', 'pants', 'shoes', 'blade',
               'claw', 'staff'];
function uceItem() {
  if (!autoUCE) return;
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
    if (upgradeItems[name] && buyable.includes(name) && (!enchantables[name] ||
        !enchantables[name].length) && character.gold >= g) {
      buy(name, 1);
      character.gold -= g;
    }
  }
  for (let name in enchantables) {
    let itemArr = enchantables[name];
    if (!itemArr || !itemArr.length) continue;
    if (sell.includes(name)) {
      for (let item of itemArr) {
        parent.sell(item.index);
      }
    } else if (upgradeItems[name]) {
      let index = itemArr[0].index, level = itemArr[0].level;
      if (level >= upgradeItems[name]) continue;
      let correctScroll = 'scroll' + item_grade(character.items[index]);
      if (enchantables[correctScroll] && enchantables[correctScroll].length &&
          enchantables[correctScroll][0].q >= 1) {
        upgrade(index, enchantables[correctScroll][0].index);
        enchantables[correctScroll][0].q -= 1;
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
          let grade = item_grade(character.items[indices[0]]);
          if (grade === 0 && level >= 2) grade = 1;
          if (grade === 1 && level >= 4) grade = 2;
          let correctCScroll = 'cscroll' + grade;
          if (enchantables[correctCScroll] &&
              enchantables[correctCScroll].length &&
              enchantables[correctCScroll][0].q >= 1) {
            compound(indices[0], indices[1], indices[2],
              enchantables[correctCScroll][0].index);
            enchantables[correctCScroll][0].q -= 1;
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

var intersecting = false;
function closestPoints(e1, e2) {
  const w1 = ('awidth' in e1) ? e1.awidth : e1.width;
  const h1 = ('aheight' in e1) ? e1.aheight : e1.height;
  const x1 = ('real_x' in e1) ? e1.real_x : e1.x;
  const y1 = ('real_y' in e1) ? e1.real_y : e1.y;
  const w2 = ('awidth' in e2) ? e2.awidth : e2.width;
  const h2 = ('aheight' in e2) ? e2.aheight : e2.height;
  const x2 = ('real_x' in e2) ? e2.real_x : e2.x;
  const y2 = ('real_y' in e2) ? e2.real_y : e2.y;

  let shortest = Infinity;
  let points;

  const box1 = [
    { x: x1 - w1 / 2, y: y1 - h1 }, // upper left
    { x: x1 + w1 / 2, y: y1 - h1 }, // upper right
    { x: x1 - w1 / 2, y: y1 }, // lower left
    { x: x1 + w1 / 2, y: y1 } // lower right
  ];
  const box2 = [
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

  intersecting = false;
  if (box1[0].x <= box2[3].x && box2[0].x <= box1[3].x &&
      box1[0].y <= box2[3].y && box2[0].y <= box1[3].y) {
    points = [{x: x1, y: y1}, {x: x2, y: y2}];
    intersecting = true;
  }

  return points;
}

function vector(points) {
  const dX = points[1].x - points[0].x;
  const dY = points[1].y - points[0].y;
  return {
    length: Math.hypot(dX, dY),
    theta: Math.atan2(dY, dX)
  };
}

var rangeAdjust = 0;
function canRangeMove(target) {
  if (!target || target.dead) {
    return false;
  }
  const vec = vector(closestPoints(character, target));
  const theta = vec.theta;
  const pfactor = Math.cos(target.angle * Math.PI / 180 - theta);
  const vt = target.speed;
  const d = vec.length - character.range;
  if (target.moving && (pfactor >= 0 || vt > 40)) {
    rangeAdjust = pfactor * vt / 4;
  } else {
    rangeAdjust = 0;
  }
  const dist = Math.ceil(d + rangeAdjust);
  const newX = character.real_x + dist * Math.cos(theta);
  const newY = character.real_y + dist * Math.sin(theta);
  return {
    dist: dist,
    theta: theta,
    target: target,
    canMove: can_move_to(newX, newY)
  };
}

function oob(x, y) {
  return (xBoundaries.length && 
           (x < xBoundaries[0] || x > xBoundaries[1]) ||
         (yBoundaries.length && 
           (y < yBoundaries[0] || y > yBoundaries[1])));
}

var lastPlus;
var lastMinus;
function rangeMove(args, forceKite) {
  let dist = args.dist, theta = args.theta;
  let t = args.target;
  let isPVP = t && t.type === 'character';
  if (!t || t.dead || t.rip) return;
  if (overrideKite) return;
  clearPath();
  let x = character.real_x, y = character.real_y;
  let newX = x + dist * Math.cos(theta);
  let newY = y + dist * Math.sin(theta);
  let oldX = newX, oldY = newY;
  if (enemiesHere &&
      team['LeonXu2'] && !team['LeonXu2'].rip && !team['LeonXu2'].dead &&
      parent.distance(character, team['LeonXu2']) > team['LeonXu2'].range) {
    move(team['LeonXu2'].real_x, team['LeonXu2'].real_y);
  } else if ((character.range <= 50 || character.range < t.range) && 
      (isPVP || dist > 0) && !intersecting && !kite && !forceKite) {
    move(x + (dist + character.range) * Math.cos(theta),
         y + (dist + character.range) * Math.sin(theta));
  } else if (dist > 0) {
    move(newX, newY);
  } else if ((kite || forceKite) && dist !== 0) {
    let small = (dist > 0) ? wallKiteRange : -wallKiteRange;
    let farX = x + (dist - wallKiteRange) * Math.cos(theta);
    let farY = y + (dist - wallKiteRange) * Math.sin(theta);
    let nearX = x + small * Math.cos(theta);
    let nearY = y + small * Math.sin(theta);
    let counter = 1;
    if (Math.abs(dist) >= wallKiteRange &&
        (!can_move_to(farX, farY) || !can_move_to(newX, newY) ||
          oob(farX, farY) && !isPVP) &&
        can_move_to(nearX, nearY) && !oob(nearX, nearY)) {
      move(nearX, nearY);
    } else {
      let originalTheta = theta;
      let pX, pY, pT;
      if (!can_move_to(nearX, nearY) &&
          (!lastPlus || new Date() - lastPlus > 2000) &&
          (!lastMinus || new Date() - lastMinus > 2000)) {
        pX = null, pY = null, pT = null;
      }
      while ((!can_move_to(nearX, nearY) ||
          oob(nearX, nearY) || pX === null || pT && pT !== counter % 2) &&
          counter <= 50) {
        if (can_move_to(nearX, nearY) && !oob(nearX, nearY)) {
          pX = nearX, pY = nearY, pT = counter % 2;
        }
        if ((!lastPlus || new Date() - lastPlus > 2000) &&
            (!lastMinus || new Date() - lastMinus > 2000)) {
          if (counter % 2 === 1) {
            theta += 2 * Math.PI / 50 * counter;
          } else {
            theta -= 2 * Math.PI / 50 * counter;
          }
        } else if (lastPlus && new Date() - lastPlus <= 2000) {
          counter++;
          theta -= 2 * Math.PI / 50;
        } else if (lastMinus && new Date() - lastMinus <= 2000) {
          counter++;
          theta += 2 * Math.PI / 50;
        }
        nearX = x + small * Math.cos(theta);
        nearY = y + small * Math.sin(theta);
        newX = x + dist * Math.cos(theta);
        newY = y + dist * Math.sin(theta);
        counter++;
      }
      if (counter > 50) {
        newX = oldX, newY = oldY;
      } else if (pX && (Math.hypot(t.real_x - pX, t.real_y - pY) >
          Math.hypot(t.real_x - nearX, t.real_y - nearY))) {
        newX = pX, newY = pY;
      }
      if (theta < originalTheta && 
          (!lastPlus || new Date() - lastPlus > 2000)) {
        lastPlus = new Date();
      } else if (theta > originalTheta && 
          (!lastMinus || new Date() - lastMinus > 2000)) {
        lastMinus = new Date();
      }
      move(newX, newY);
    }
  }
}


const isLeon = (character.name === 'LeonXu2');
var lastAvoided;
function avoid(player) {
  if (currentPath) return;
  if (character.moving || (player.moving || isLeon) &&
      party.includes(player.name)) {
    return;
  }
  if (turretMode && !party.includes(player.name) &&
      player.ctype !== 'merchant' && player.range > character.range) {
    const distance = parent.distance(player, character);
    if (distance <= player.range + 5 && !in_attack_range(player)) {
      let distParams = canRangeMove(player);
      distParams.dist = distance - (player.range + 15);
      rangeMove(distParams, true);
    }
  } else if (parent.simple_distance(character, player) < 10) {
    let distParams = canRangeMove(player);
    if (!party.includes(player.name) && distParams.canMove) {
      rangeMove(distParams, true);
    } else {
      distParams.dist = 15;
      let oldwkr = wallKiteRange;
      wallKiteRange = 15;
      rangeMove(distParams, true);
      wallKiteRange = oldwkr;
    }
    lastAvoided = player;
  }
}

var team = {};
var enemiesHere = false;
var merch;
function searchTargets(maxHP, minXP, currentTarget) {
  if (currentTarget && currentTarget.type !== 'character' && !parent.pvp &&
        (!currentTarget.target || party.includes(currentTarget.target)) &&
      character.ctype !== 'priest' && !pocket &&
      (solo || !tanks.includes(character.name)) &&
      (parent.distance(currentTarget, character) <= character.range + 50 ||
        currentTarget.target === character.name) || alwaysAttackTargeted) {
    return currentTarget;
  }
  let target = null;
  const enemies = [];
  const allies = [];
  let foundPriority = false;
  enemiesHere = false;
  if (p !== true) p = null;
  merch = null;
  for (let id in parent.entities) {
    let current = parent.entities[id];
    if (current.name === merchName) {
      merch = current;
    } else if (current.type === 'character' && !current.rip && !current.npc) {
      if (party.includes(current.name)) {
        allies.push(current);
      } else {
        enemies.push(current);
        if (!enemiesHere && current.ctype !== 'merchant') {
          enemiesHere = true;
        }
        if (current.name === priorityEnemy) {
          foundPriority = true;
        }
      }
    }
    if (current.type === 'character') {
      avoid(current);
    }
    if (character.ctype === 'priest' && current.type === 'character' &&
        party.includes(current.name) && !current.rip &&
        current.hp / current.max_hp < healAt &&
        (!target || !party.includes(target.name) ||
          current.hp / current.max_hp < target.hp / target.max_hp)) {
      target = current;
    } else if (current.type === 'monster' && attackMonsterToggle &&
        (!target || !party.includes(target.name)) &&
        (!current.target || party.includes(current.target)) && !current.dead) {
      let ci = priorityMonsters.indexOf(current.mtype);
      let ti = !target || priorityMonsters.indexOf(target.mtype);
      if ((!solo && tanks.includes(current.target) &&
          current.target !== character.name) ||
          (tanks.includes(current.target) || ((tanks.includes(character.name) ||
          solo) && priorityMonsters.includes(current.mtype)) ||
          party.includes(current.target)) &&
            (ti === true || ti === -1 || ci === ti && 
            current.hp > 3500 && (((target.target === character.name) === 
            (party.includes(current.target))) &&
            parent.distance(character, current) < 
            parent.distance(character, target) ||
          (target.target !== character.name &&
          party.includes(current.target))) || ci < ti)) {
        target = current;
      } else if (parent.distance(character, current) <= maxMonsterDistance &&
          (!target || !priorityMonsters.includes(target.mtype)) &&
          current.max_hp <= maxHP && current.xp >= minXP &&
          ((target === null ||
            current.xp / current.max_hp > target.xp / target.max_hp) ||
          target.mtype === current.mtype &&
            (((target.target === character.name) === 
             (party.includes(current.target))) &&
              parent.distance(character, current) < 
              parent.distance(character, target) ||
            (target.target !== character.name && 
            party.includes(current.target))))) {
        target = current;
      }
    }
    if (pocket && current.type === 'character' && pocket === current.name &&
        !current.dead && !current.rip) {
      p = current;
    }
  }
  if (priorityEnemy && !foundPriority) {
    priorityEnemy = null;
    receivedCM = false;
  }
  if (character.ctype === 'priest' && !character.rip &&
      ((!target || target.type === 'monster') &&
        character.hp / character.max_hp < healAt || target &&
      target.type === 'character' &&
      character.hp / character.max_hp < target.hp / target.max_hp)) {
    return character;
  }
  if (parent.pvp || character.ctype === 'priest' || !solo && 
      tanks.includes(character.name)) {
    if (!target || currentTarget && !party.includes(currentTarget.name) &&
        (!target || !party.includes(target.name)) &&
        (!currentTarget.target || party.includes(currentTarget.target)) &&
        (parent.distance(currentTarget, character) <= character.range + 50 ||
          currentTarget.target === character.name) &&
        (solo || !tanks.includes(character.name) || currentTarget &&
        currentTarget.hp > 3500)) {
      target = currentTarget;
    }
  }
  for (let ally of allies) {
    if (!team[ally.name] || team[ally.name] !== ally) {
      team[ally.name] = ally;
    }
  }
  if (parent.pvp && enemies.length > 0) {
    allies.push(character);
    return {players: true, allies: allies, enemies: enemies, target: target};
  }
  if (!enemiesHere) {
    receivedCM = false;
    priorityEnemy = null;
  }
  return target;
}

var keyItems = {
  'hpot0': [],
  'hpot1': [],
  'mpot0': [],
  'mpot1': [],
  'eggnog': []
};
var enchantables = {};
function searchInv() {
  for (let name in keyItems) {
    keyItems[name] = [];
  }
  for (let name in enchantables) {
    enchantables[name] = [];
  }
  for (let i = character.items.length - 1; i >= 0; i--) {
    let item = character.items[i];
    if (!item) continue;
    let name = item.name, level = item.level;
    let itemObject = {
      q: item.q,
      level: level,
      index: i
    };
    if (name in keyItems) {
      keyItems[name].push(itemObject);
    } else if (name.includes('scroll') || G.items[name].compound ||
        G.items[name].e || name in upgradeItems || sell.includes(name)) {
      enchantables[name] ?
        enchantables[name].push(itemObject) :
        enchantables[name] = [itemObject];
    }
  }
}

function giveToMerch(force) {
  if ((!character.afk && !force) ||
      (!merch || parent.distance(character, merch) > 400)) {
    return;
  }
  if (character.gold > 100000 && merch) {
    send_gold(merch, character.gold - 20000);
  }
  for (let name in enchantables) {
    const itemArr = enchantables[name];
    for (let i = itemArr.length - 1; i >= 0; i--) {
      const item = itemArr[i];
      send_item(merch, item.index, item.q);
    }
  }
}

function potions() {
  if (character.rip) return;
  if (enemiesHere && !character.slots['elixir'] && keyItems.eggnog &&
      keyItems.eggnog.length) {
    use(keyItems.eggnog[0].index);
  }
  if (!merchJ && merch && merch.code && character.ctype !== 'warrior' &&
      (keyItems.mpot0.length === 0 || keyItems.mpot0.length === 1 &&
      keyItems.mpot0[0].q < 100)) {
    part.forEach(function (name) {
      send_cm(name, {message: 'potions'});
    });
  }
  const t = get_target();
  if (parent.pvp && t && !t.dead && !t.rip && t.type === 'character' &&
      !party.includes(t.name)) {
    if (character.ctype === 'priest' &&
        character.mp < character.max_mp - 500 &&
        new Date() > parent.next_potion && keyItems.mpot1.length) {
      use(keyItems.mpot1[0].index);
    } else if (character.mp < character.mp_cost + 150 &&
        new Date() > parent.next_potion && keyItems.mpot1.length) {
      use(keyItems.mpot1[0].index);
    } else if (keyItems.mpot1.length === 0) {
      use('use_mp');
    } else if (character.ctype !== 'priest' &&
        character.hp < character.max_hp - 325 &&
        new Date() > parent.next_potion && keyItems.hpot1.length) {
      use(keyItems.hpot1[0].index);
    }
  } else {
    if (character.hp / character.max_hp <= 0.4 &&
        new Date() > parent.next_potion && keyItems.hpot1.length) {
      use(keyItems.hpot1[0].index);
    } else if (character.mp < character.mp_cost + 50 &&
        keyItems.mpot0.length && new Date() > parent.next_potion) {
      use(keyItems.mpot0[0].index);
    } else if (character.max_hp - character.hp > useHP &&
        keyItems.hpot0.length && new Date() > parent.next_potion) {
      use(keyItems.hpot0[0].index);
    } else if (character.max_mp - character.mp > useMP &&
        keyItems.mpot0.length && new Date() > parent.next_potion) {
      use(keyItems.mpot0[0].index);
    } else if (keyItems.mpot0.length === 0 && keyItems.mpot1.length === 0 &&
        character.max_mp - character.mp > 100 &&
        new Date() > parent.next_potion) {
      use('use_mp');
    } else if (keyItems.hpot0.length === 0 && keyItems.hpot1.length === 0 &&
        character.hp / character.max_hp < .25) {
      use('use_hp');
    }
  }
}

function playerStrength(player) {
  return ((player.invis ? player.attack * 0.8 : player.attack) *
      player.frequency) + player.armor +
    player.resistance + player.max_hp * 0.5 + player.speed + player.range;
}
function pvpStrength(player) {
  if (player.ctype === 'ranger') {
    return 33**4 + playerStrength(player);
  } else if (player.ctype === 'mage') {
    return 33**3 + playerStrength(player);
  } else if (player.ctype === 'priest') {
    return 33**2 + playerStrength(player);
  } else if (player.ctype === 'rogue') {
    return 33**1 + playerStrength(player);
  } else {
    return playerStrength(player);
  }
}

if (character.ctype === 'ranger') {
  var rangers = character.attack;
}
var receivedCM = false;
function doPVP(targets) {
  const allies = targets.allies;
  const enemies = targets.enemies;
  let strongestEnemy = enemies[0];
  let nearestEnemy = enemies[0];
  let strongestPVP = enemies[0];
  let strongestAlly = allies[0];
  let injured;
  let rangersum = 0;
  for (let enemy of enemies) {
    if (playerStrength(enemy) > playerStrength(strongestEnemy)) {
      strongestEnemy = enemy;
    }
    if (pvpStrength(enemy) > pvpStrength(strongestPVP)) {
      strongestPVP = enemy;
    }
    if (parent.distance(character, enemy) < 
        parent.distance(character, nearestEnemy)) {
      nearestEnemy = enemy;
    }
    if (priorityEnemy && enemy.name === priorityEnemy) {
      change_target(enemy);
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
    if (ally.ctype === 'ranger') {
      rangersum += ally.attack;
    }
  }
  rangers = rangersum;
  if (injured) {
    change_target(injured);
  } else if ((!turretMode || in_attack_range(nearestEnemy)) && !receivedCM) {
    if (nearestEnemy.ctype === 'merchant') {
      change_target(nearestEnemy);
      return;
    }
    let e;
    if (!strongestPVP.invincible && strongestPVP.ctype !== 'merchant') {
      e = strongestPVP;
    } else if (!strongestEnemy.invincible &&
        strongestEnemy.name !== nearestEnemy.name &&
        strongestEnemy.ctype !== 'merchant') {
      e = strongestEnemy;
    } else if (enemies.length > 2) {
      for (let enemy of enemies) {
        if (!enemy.invincible && enemy.ctype !== 'merchant') {
          e = enemy;
          break;
        }
      }
    }
    if (e) {
      change_target(e);
      if (turretMode) {
        receivedCM = true;
        priorityEnemy = e.name;
        part.forEach(function (name) {
          send_cm(name, {message: e.name});
        });
      }
    }
    if (!parent.ctarget) change_target(targets.target);
  } else if (targets.target && (party.includes(targets.target.name) ||
      attackMonsterToggle && targets.target.type === 'monster') &&
      !receivedCM) {
    change_target(targets.target);
  }
}

var dangle = [-8, -8];
if (character.name === 'Glass') dangle = [-8, 8];
else if (character.name === 'Marksmen') dangle = [8, -8];
else if (character.name === 'NopoRanger') dangle = [8, 8];
var p;
function movePocket() {
  let x = p.real_x + dangle[0];
  let y = p.real_y + dangle[1];
  if (lastAvoided && !lastAvoided.dead && !lastAvoided.moving &&
      Math.hypot(lastAvoided.real_x - x, lastAvoided.real_y - y) < 10 ||
      journeying) {
    return;
  }
  if (character.real_x !== x || character.real_y !== y) {
    if (can_move_to(x, y)) {
      move(x, y);
    } else {
      // pathTimeout = null;
      currentPath = pathfind(p.real_x, p.real_y);
    }
  }
}

function attackPlayer(player) {
  if (alwaysAttackTargeted === 1) return;
  const distParams = canRangeMove(player);
  if (!in_attack_range(player)) {
    if (distParams.canMove || can_move_to(player)) {
      if (character.ctype === 'warrior') {
        charge();
      }
      rangeMove(distParams);
    } else if (!currentPath || currentPath.length === 0) {
      currentPath = pathfind(player.real_x, player.real_y);
    }
  } else {
    rangeMove(distParams, character.range > player.range);
  }
}

function attackMonster(target) {
  if (p && !priorityMonsters.includes(target.mtype)) {
    movePocket();
    return;
  }
  if (journeying && !priorityMonsters.includes(target.mtype)) return;
  if (target && !target.dead) {
    const distParams = canRangeMove(target);
    if (!distParams.canMove && !can_move_to(target) &&
        !in_attack_range(target)) {
      if ((!currentPath || currentPath.length === 0) && pathfindTo) {
        currentPath = pathfind(target.real_x, target.real_y);
      }
    } else if (target && !target.dead) {
      rangeMove(distParams, priorityMonsters.includes(target.mtype) && solo &&
                  character.range > 50);
    }
  }
}

function healPlayer(player) {
  const distParams = canRangeMove(player);
  if (!distParams.canMove && !can_move_to(player) && !in_attack_range(player)) {
    if (!currentPath || currentPath.length === 0) {
      currentPath = pathfind(player.real_x, player.real_y);
    }
  } else if (player && !player.dead && !player.rip &&
      !in_attack_range(player)) {
    rangeMove(distParams);
  } else if (etarget && !etarget.dead && !etarget.rip) {
    if (etarget.type === 'character') {
      attackPlayer(etarget);
    } else {
      attackMonster(etarget);
    }
  }
}

function getClosest(target) {
  let min = Infinity;
  for (let name in team) {
    let current = team[name];
    if (!current.dead && !current.rip) {
      let distance = parent.distance(current, target);
      if (distance < min) {
        min = distance;
      }
    }
  }
  return min;
}

var attackData = {
  length: 1,
  maxLength: 1000,
  avg: 1000 / character.frequency - ping,
  addValue: function (value) {
    this.avg = (this.avg * this.length + value) / (this.length + 1);
    this.length++;
  }
};
var att = {
  delay: 1000 / character.frequency - ping,
  attempting: false,
  attack: function () {
    var target = parent.ctarget;
    att.attempting = true;
    if (!target || target.dead || target.rip && alwaysAttackTargeted !== 2 ||
        alwaysAttackTargeted === 1) {
      att.attempting = false;
      set_message('No target');
    } else if (parent.is_disabled(character) || !in_attack_range(target) ||
        character.mp < character.mp_cost) {
      setTimeout(att.attack, 250);
    } else if (target.type === 'character' && character.ctype === 'priest' &&
        party.includes(target.name) && target.hp / target.max_hp < healAt) {
      parent.socket.emit("click", {
        type: "player_heal",
        id: target.id,
        button: "right"
      });
      set_message('Healing ' + target.name);
    } else if (target.type === 'monster' && (!target.target ||
        party.includes(target.target))) {
      parent.socket.emit("click", {
        type: "monster",
        id: target.id,
        button: "right"
      });
      set_message('Attacking ' + target.mtype);
    } else if (parent.pvp && !party.includes(target.name)) {
      let d = getClosest(target);
      if (d <= 6) {
        setTimeout(att.attack, 250);
      } else {
        parent.socket.emit("click", {
          type: "player_attack",
          id: target.id,
          button: "right"
        });
        set_message('Attacking ' + target.name);
      }
    } else {
      att.attempting = false;
    }
  }
};

function hitSuccess(data) {
  if (data.hid === character.id && !G.skills[data.anim]) {
    attackData.addValue(att.delay);
    var adjust = 0;
    if (attackData.length < attackData.maxLength) {
      att.delay = attackData.avg - 100 / attackData.length;
    } else {
      adjust = 1;
    }
    setTimeout(att.attack, att.delay + adjust);
    att.attempting = false;
  }
}

function hitFailure(data) {
  if (data.message === 'EVADE!' && data.args.from === character.id) {
    hitSuccess({hid: character.id});
  } else if (data.message === 'MISS' && att.attempting) {
    var adjust = 150 / attackData.length;
    att.delay += Math.ceil(adjust);
    setTimeout(att.attack, adjust);
  }
}

function useAbilityOn(target) {
  if (!target || target.dead || target.rip) {
    return;
  } else if (character.ctype === 'rogue' && target.ctype !== 'rogue') {
    invis();
  } else if (character.ctype === 'warrior' &&
      parent.distance(target, character) <= 200 && !can_attack(target)) {
    taunt(target);
  } else if (character.ctype === 'ranger' && target.level > 65 && 
      target.max_hp > 2000 && (target.type === 'monster' ||
      target.hp <= (1 - target.armor / 1000) * rangers * 1.5)) {
    supershot(target);
  } else if (character.ctype === 'priest' &&
      parent.distance(target, character) <= 200) {
    curse(target);
  } else if (character.ctype === 'mage' && target.max_hp > 2000 &&
      parent.distance(target, character) <= character.range + 20 &&
      character.mp / character.max_mp > 0.8 && target.level > 65) {
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
  if ((!character.slots.offhand ||
      character.slots.offhand.name !== 'shield') && !shieldEquipped) {
    if (keyItems.shield.length) {
      equip(keyItems.shield.reduce(function (prev, curr) {
        return prev.level > curr.level ? prev : curr;
      }).index);
    }
  }
  shieldEquipped = true;
}

function equipWeapon() {
  if (character.slots.offhand &&
      character.slots.offhand.name === 'shield' && shieldEquipped) {
    if (weapon.includes('blade')) {
      parent.socket.emit('unequip', {slot: 'offhand'});
    }
    if (keyItems[weapon].length) {
      equip(keyItems[weapon].reduce(function (prev, curr) {
        return prev.level > curr.level ? prev : curr;
      }).index);
    }
  }
  shieldEquipped = false;
}

function equipLoop() {
  if ((character.ctype === 'warrior' || character.ctype === 'priest') &&
      (keyItems.shield && keyItems.shield.length || character.slots.offhand &&
      character.slots.offhand.name === 'shield') && shieldSwitch) {
    const t = get_target();
    if (!t || t.dead || t.rip || character.rip) {
      equipShield();
    } else if (!parent.next_attack || parent.next_attack - new Date() <= 150 &&
        in_attack_range(t)) {
      equipWeapon();
    } else if (parent.next_attack && parent.next_attack > new Date()) {
      equipShield();
    }
  }
}

function closestSpawn() {
  const spawns = G.maps[lastMap].spawns;
  let closest = spawns[0], ci = 0;
  for (let i = spawns.length - 1; i > 0; i--) {
    let coord = spawns[i];
    if (Math.hypot(lastPos[1] - coord[1], lastPos[0] - coord[0]) <
        Math.hypot(lastPos[1] - closest[1], lastPos[0] - closest[0])) {
      closest = coord;
      ci = i;
    }
  }
  return ci;
}

function hasTransporter() {
  for (let npc of G.maps[character.map].npcs) {
    if (npc.id === 'transporter') {
      return true;
    }
  }
  return false;
}

function exitLocation() {
  let d;
  for (let door of G.maps[character.map].doors) {
    if (door[4] === jMap) {
      d = door;
    }
  }
  let retS = null;
  let retD = null;
  for (let s of G.maps[character.map].spawns) {
    if (!d && s.length === 3) {
      for (let door of G.maps[character.map].doors) {
        if ((!retD || Math.hypot(s[0] - door[0], s[1] - door[1]) <
            Math.hypot(retS[0] - retD[0], retS[1] - retD[1]))) {
          retD = door;
        }
      }
      return [s, retD];
    } else {
      if (!d) d1 = G.maps[character.map].doors[0];
      else d1 = d;
      if ((!retS || Math.hypot(s[0] - d1[0], s[1] - d1[1]) <
          Math.hypot(retS[0] - d1[0], retS[1] - d1[1]))) {
        retS = s;
      }
    } 
  }
  if (!d) {
    return [retS, G.maps[character.map].doors[0]];
  }
  return [retS, d];
}

var jLoc;
var jMap;
var jRet = function () {};
var jS;
function journey(map, loc, ret, s) {
  journeying = true;
  jMap = map;
  jLoc = loc;
  jS = s;
  if (typeof(ret) === 'function') {
    jRet = ret;
  } else {
    jRet = function () {};
  }
}

function pathBack() {
  if (p) return;
  journey(lastMap, lastPos);
}

function pf(x, y) {
  if (can_move_to(x, y)) {
    if (!character.moving || character.going_x !== x ||
        character.going_y !== y) {
      move(x, y);
    }
  } else if (!currentPath && !currentPoint) {
    currentPath = pathfind(x, y);
  }
}

let transporting = false;
function journeyMove() {
  if (!journeying || parent.ctarget && (!party.includes(parent.ctarget.name) ||
      priorityMonsters.includes(parent.ctarget.mtype))) return;
  if (character.map !== jMap) {
    let s, doors;
    [s, doors] = exitLocation();
    if (!s) {
      console.debug('map does not have length 3 spawn');
      return;
    }
    if (character.real_x !== s[0] || character.real_y !== s[1]) {
      pf(s[0], s[1]);
    } else if (!transporting) {
      currentPoint = null;
      currentPath = null;
      transporting = true;
      setTimeout(function () {
        let css = 0;
        if (jS != null) css = jS;
        if (hasTransporter()) {
          parent.socket.emit('transport', {to: jMap, s: css});
        } else {
          parent.socket.emit('transport', {to: doors[4], s: doors[5]});
        }
        transporting = false;
      }, 3000);
    }
  } else if (jLoc &&
      (character.real_x !== jLoc[0] || character.real_y !== jLoc[1])) {
    pf(jLoc[0], jLoc[1]);
  } else {
    clearPath(true);
  }
}

var currentPoint;
var currentPath;
function pathfindMove() {
  if (overrideKite) return;
  if ((!currentPath || !currentPath.length) && (!currentPoint ||
      character.real_x === currentPoint.x &&
      character.real_y === currentPoint.y)) {
    currentPoint = null;
    currentPath = null;
  }
  if (!currentPath || !currentPath.length) return;
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
  } else if (!currentPoint && currentPath && currentPath.length) {
    move(currentPath[0].x, currentPath[0].y);
  }
}

function blhelper(x, y, i) {
  let nX = x, nY = y, bX = x, bY = y;
  if (i === 0) nX -= 10, bX += 20;
  else if (i === 1) nX += 10, bX -= 20;
  else if (i === 2) nY -= 10, bY += 20;
  else nY += 10, bY -= 20;
  if (can_move({map: character.map, x: x, y: y, going_x: nX, going_y: nY})) {
    return [x, y];
  } else {
    return [bX, bY];
  }
}
function betterLocs(x1, y1, x2, y2) {
  let bx1 = x1, by1 = y1, bx2 = x2, by2 = y2;
  for (let i = 0; i < 4; i++) {
    [bx1, by1] = blhelper(bx1, by1, i);
  }
  for (let i = 0; i < 4; i++) {
    [bx2, by2] = blhelper(bx2, by2, i);
  }
  return [bx1, by1, bx2, by2];
}
var currentMap;
var graph;
// var pathTimeout;
function pathfind(x, y, x2, y2) {
  // if (pathTimeout && new Date() - pathTimeout < 10000) {
  //   return null;
  // }
  if (!currentMap || currentMap !== character.map) {
    currentMap = character.map;
    graph = initialize_graph(character.map);
  }
  let from, to, path;
  let fX, fY, tX, tY, bx1, by1, bx2, by2;
  if (x2 == null || y2 == null) {
    bx1 = character.real_x, by1 = character.real_y, bx2 = x, by2 = y;
  } else {
    bx1 = x, by1 = y, bx2 = x2, by2 = y2;
  }
  [fX, fY, tX, tY] = betterLocs(bx1, by1, bx2, by2);
  from = graph.get(fX, fY);
  to = graph.get(tX, tY);
  try {
    path = find_path(from, to);
  } catch (e) {
    path = null;
  }
  // if (!path || path.length === 0) {
  //   pathTimeout = new Date();
  // }
  return path;
}

function clearPath(bool) {
  currentPath = null;
  currentPoint = null;
  jMap = null;
  jLoc = null;
  journeying = false;
  if (bool) jRet();
  jRet = function () {};
}

function boosters() {}

if (character.items[0] && character.items[0].name.includes('booster')) {
  if (character.name !== 'Glass') {
    boosters = function () {
      if (!team['Glass'] || team['Glass'].dead || !team['Glass'].code) return;
      if (Object.keys(parent.chests).length >= 2) {
        if (character.items[0].name !== 'goldbooster') {
          shift(0, 'goldbooster');
        }
      } else if (character.items[0].name !== 'xpbooster')  {
        shift(0, 'xpbooster');
      }
    };
  } else {
    loot = function() {
      if (Object.keys(parent.chests).length >= 2) {
        if (!character.items[0] || character.items[0].name !== 'xpbooster') {
          setTimeout(function () {
            let counter = 0;
            for (let id in parent.chests) {
              if (counter >= 2) break;
              parent.socket.emit('open_chest', {id: id});
              counter++;
            }
            shift(0, 'xpbooster');
          }, 400);
        } else if (character.items[0].name !== 'goldbooster') {
          shift(0, 'goldbooster');
        }
      }
    };
  }
}

var counter = 2;
var etarget;
function main() {
  if (character.rip) return;
  counter = (counter + 1) % 3;
  loopAddition();
  searchInv();
  if (!doAttack || alwaysAttackTargeted === 1) return;
  let target = get_target();
  if (target && (target.dead || !alwaysAttackTargeted && target.rip ||
      character.ctype === 'priest' && party.includes(target.name) &&
      target.hp / target.max_hp >= healAt)) {
    lastPlus = null;
    lastMinus = null;
    target = null;
    parent.ctarget = null;
  }
  if (target && target.rip) {
    priorityEnemy = null;
    receivedCM = false;
  }
  let t = searchTargets(maxMonsterHP, minMonsterXP, target);
  if (t && 'players' in t) {
    doPVP(t);
    t = get_target();
  } else if (t) {
    change_target(t);
  }
  if (!target) att.attempting = false;
  if ((!parent.next_attack || new Date() > parent.next_attack) && 
      !att.attempting) {
    att.attack();
  }
  if (t && (t.type === 'monster' || !party.includes(t.name))) etarget = t;
  equipLoop();
  if (t && t.type === 'character' && !party.includes(t.name) ||
      t && t.type === 'monster' && (useAbilities === true ||
      useAbilities !== false && useAbilities <= t.hp)) {
    useAbilityOn(t);
  }
  if (counter % 3 !== 2) return;
  boosters();
  if (!team['Glass'] || team['Glass'].dead || !team['Glass'].code) loot();
  inTown() ? uceItem() : giveToMerch();
  pathfindMove();
  journeyMove();
  potions();
  if (p && p.in === character.in &&
      !p.dead && !p.rip && (!t || in_attack_range(t))) {
    movePocket();
  } else if (t && t.type === 'character' &&
      character.ctype === 'priest' && party.includes(t.name)) {
    healPlayer(t);
  } else if (parent.pvp && t && t.type === 'character' && !t.rip &&
      !party.includes(t.name)) {
    attackPlayer(t);
  } else if (attackMonsterToggle && t && t.type === 'monster') {
    attackMonster(t);
  } else if (((lastPos && Math.hypot(character.real_x - lastPos[0],
      character.real_y - lastPos[1]) > returnDistance &&
      character.map === lastMap) || (character.map !== lastMap &&
      returnDistance < Infinity)) && character.afk && !journeying) {
    pathBack();
  }
}

setCorrectingInterval(main, 100);
if (character.ctype === 'warrior') {
  var weapon = 'blade';
  keyItems.shield = [];
  keyItems[weapon] = [];
  var shieldEquipped = character.slots.offhand &&
      character.slots.offhand.name === 'shield';
} else if (character.ctype === 'priest') {
  var weapon = 'wbook0';
  keyItems.shield = [];
  keyItems[weapon] = [];
  var shieldEquipped = character.slots.offhand &&
      character.slots.offhand.name === 'shield';
}

parent.socket.on('hit', hitSuccess);
parent.socket.on('disappearing_text', hitFailure);
