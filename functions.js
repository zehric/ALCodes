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

var attackMonsterToggle = true;
var alwaysAttackTargeted = false;
function keybindings(e) {
  if (e.keyCode === 113) {
    parent.socket.emit('transport', {to: 'bank'});
  } else if (e.keyCode === 16) {
    parent.render_transports_npc();
  } else if (e.keyCode === 192) {
    parent.socket.emit('transport', {to: 'jail'});
  } else if (e.keyCode === 221) {
    attackMonsterToggle = !attackMonsterToggle;
  } else if (e.keyCode === 219) {
    kite = !kite;
  } else if (e.keyCode === 187) {
    alwaysAttackTargeted = !alwaysAttackTargeted;
  }
}

parent.window.addEventListener('keydown', keybindings);

on_destroy = function () {
  parent.window.removeEventListener('keydown', keybindings);
};

handle_death = function () {
  function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
  }
  var timer = getRandomInt(12000, 300000);
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
  if (target.moving) {
    rangeAdjust = (character.speed / (character.speed + target.speed)) *
      (Math.cos(target.angle * Math.PI / 180 - theta) * 
        target.speed * (loopInterval / 1000) -
      (target.speed / character.speed) * (vec.length - character.range));
  } else {
    rangeAdjust = 0;
  }
  rangeAdjust = (target.speed >= 30 || rangeAdjust > 0) ? rangeAdjust : 0;
  var dist = Math.ceil(vec.length - character.range + rangeAdjust);
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
  if (dist > 0) {
    move(newX, newY);
  } else if ((kite || forceKite) && 
      (!lastAdjust || new Date() - lastAdjust > 300)) {
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
        !current.npc && (canRangeMove(current).canMove || 
            can_move_to(current) ||
          parent.distance(character, current) <= current.range + 100 ||
          (current.ctype === 'ranger' && 
            parent.distance(character, current) <= 600))) {
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
    if ((canRangeMove(current).canMove || can_move_to(current)) && 
        (!target || target.type !== 'character') &&
        (!current.target || party.includes(current.target)) &&
        current.type === 'monster' && !current.dead && 
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
  if (enemies.length !== 0) {
    allies.push(character);
    return { players: true, allies: allies, enemies: enemies };
  }
  if (parent.pvp || character.ctype === 'priest') {
    if (currentTarget && !party.includes(currentTarget.name) &&
        (!target || !party.includes(target.name)) &&
        (!currentTarget.target || party.includes(currentTarget.target)) &&
        (parent.distance(currentTarget, character) <= character.range + 50 || 
          currentTarget.target === character.name)) {
      return currentTarget;
    }
  }
  return target;
}

var hasHPPot0 = false;
var hasMPPot0 = false;
var hasHPPot1 = false;
var hasMPPot1 = false;
function potions() {
  if (character.rip) {
    return;
  }
  var t = get_target();
  var survive = willSurvive(t);
  if (!survive && parent.distance(t, character) <= (t.range || 
      parent.G.monsters[t.mtype].range) + 25) {
    if (character.afk) {
      show_json('Fled from ' + (t.mtype || t.name));
    }
    set_message('Fled from ' + (t.mtype || t.name));
    flee();
  }
  if (character.mp < character.mp_cost && !hasMPPot1) {
    hasMPPot1 = true;
    buy('mpot1', 1);
  } else if (character.mp < buyMPPotAt && !hasMPPot0 && !hasMPPot1) {
    hasMPPot0 = true;
    buy('mpot0', 1);
  }
  if (!survive && !hasHPPot1) {
    hasHPPot1 = true;
    buy('hpot1', 1);
  } else if (character.hp < buyHPPotAt && !hasHPPot0 && !hasHPPot1) {
    hasHPPot0 = true;
    buy('hpot0', 1);
  }
  if (new Date() > parent.next_potion) {
    if (!survive) {
      hasHPPot1 = false;
      parent.use('hp');
    } else if (character.mp < character.mp_cost) {
      hasMPPot1 = false;
      parent.use('mp');
    } else if (character.max_hp - character.hp > useHP) {
      hasHPPot0 = false;
      parent.use('hp');
    } else if (character.max_mp - character.mp > useMP) {
      hasMPPot0 = false;
      parent.use('mp');
    }
  }
}

function willSurvive(target) {
  return !target || party.includes(target.name) || target.dead || target.rip ||
    target.npc || target.ctype === 'merchant' || (target.type === 'monster' && 
      (target.target !== character.name ||
        (parent.G.monsters[target.mtype].damage_type === 'physical' &&
          character.hp > target.attack * (1 - character.armor / 1000)) ||
        (parent.G.monsters[target.mtype].damage_type === 'magical' &&
          character.hp > target.attack * (1 - character.resistance / 1000)))) ||
      (target.type === 'character' && (target.target !== character.id ||
        (parent.G.classes[target.ctype].damage_type === 'physical' &&
          character.hp > target.attack * (1 - character.armor / 1000)) ||
        (parent.G.classes[target.ctype].damage_type === 'magical' &&
          character.hp > target.attack * (1 - character.resistance / 1000))));
}

var buyable = ['coat', 'gloves', 'helmet', 'bow', 'pants', 'shoes', 'blade', 
               'claw', 'staff'];
var statScroll = parent.G.classes[character.ctype].main_stat + 'scroll';
var wait = false;
function uceItem() {
  if (!autoUCE || wait || character.map === 'bank' || 
      (character.ctype === 'warrior' && (character.slots['offhand'] === null || 
      character.slots['offhand'].name === 'shield'))) {
    return;
  }
  function correctScroll(item) {
    if (!item.name) {
      return null;
    }
    let grades = parent.G.items[item.name].grades;
    if (item.level < grades[0]) {
      return 'scroll0';
    } else if (item.level < grades[1]) {
      return 'scroll1';
    } else {
      return 'scroll2';
    }
  }
  function correctCScroll(item) {
    if (typeof(item.level) !== 'number') {
      return null;
    }
    if (item.level < 2) {
      return 'cscroll0';
    } else if (item.level < 4) {
      return 'cscroll1';
    } else {
      return 'cscroll2';
    }
  }
  var toUpgrades = {}; // name: idx
  var toStats = {}; // name: idx
  var toCompounds = {}; // name[level]: [idx1, idx2, idx3]
  var scrolls = {}; // name: [idx, desiredQuantity]
  var toExchanges = []; // [idx1, idx2, ...]
  var emptySlots = []; // [idx1, idx2, ...]
  if (upgradeAll) {
    for (let slot in character.slots) {
      let item = character.slots[slot];
      if (item && buyable.includes(item.name) && item.level < upgradeTo) {
        toUpgrades[item.name] = true;
      }
    }
  }
  if (upgradeItems) {
    for (let name in upgradeItems) {
      if (!toUpgrades[name] && buyable.includes(name)) {
        toUpgrades[name] = true;
      }
    }
  }
  for (let i = 0; i < character.items.length; i++) {
    let item = character.items[i];
    if (item === null) { // add to empty slots
      emptySlots.push(i);
    } else if (parent.G.items[item.name].e &&
        parent.G.items[item.name].e <= item.q) { // add to exchange
      toExchanges.push(i);
    } else if (toUpgrades[item.name] && !upgradeItems[item.name] && 
          item.level < upgradeTo ||
        upgradeItems[item.name] && item.level < upgradeItems[item.name]) { 
      // add to upgrades
      toUpgrades[item.name] = i;
    } else if (toUpgrades[item.name] && !upgradeItems[item.name] &&
        item.level >= upgradeTo ||
      upgradeItems[item.name] && item.level >= upgradeItems[item.name]) { 
      // remove if > upgradeTo
      // add to stats if doesn't have a stat
      if (!item.stat_type && parent.G.items[item.name].stat && autoStat) {
        toStats[item.name] = i;
      } else if (autoStat) { // autoequip
        for (let slot in character.slots) {
          let equipped = character.slots[slot];
          if (equipped && equipped.name === item.name && 
              equipped.level < item.level && 
              equipped.stat_type === item.stat_type) {
            equip(i);
            break;
          }
        }
      }
      delete toUpgrades[item.name];
    } else if (item.name.startsWith('scroll') || 
        item.name.startsWith('cscroll') || item.name === statScroll) { 
        // add to scrolls
      scrolls[item.name] = [i, 0];
    } else if (parent.G.items[item.name].compound) { // add to compounds
      let ckey = item.name + item.level;
      if (toCompounds[ckey] && toCompounds[ckey].length < 3) {
        toCompounds[ckey].push(i);
      } else if (!toCompounds[ckey]) {
        toCompounds[ckey] = [i];
      }
    }
  }
  if (character.items.length < 42) {
    for (let i = character.items.length; i < 42; i++) {
      emptySlots.push(i);
    }
  }
  if (emptySlots.length === 0) {
    return;
  }
  var gc = 0;
  for (let item in toUpgrades) { // buy items and add to scrolls
    let index = toUpgrades[item];
    let s;
    if (typeof(index) !== 'number') {
      if (character.gold >= parent.G.items[item].g) {
        toUpgrades[item] = emptySlots.shift();
        buy(item, 1);
        gc += parent.G.items[item].g;
        s = 'scroll0';
      } else {
        delete toUpgrades[item];
      }
    } else {
      s = correctScroll(character.items[index]);
    }
    if (s && !scrolls[s] && character.gold >= parent.G.items[s].g + gc) {
      scrolls[s] = [null, 1];
    } else if (s && scrolls[s] && (scrolls[s][0] !== null && 
        character.gold >= parent.G.items[s].g *
          (scrolls[s][1] + 1 - character.items[scrolls[s][0]].q) + gc ||
        scrolls[s][0] === null && 
          character.gold >= parent.G.items[s].g * (scrolls[s][1] + 1) + gc)) {
      scrolls[s][1] += 1;
    } else {
      delete toUpgrades[item];
    }
  }
  for (let item in toCompounds) { // add to scrolls
    let indices = toCompounds[item];
    if (indices.length === 3) {
      let itemObject = character.items[indices[0]];
      let cs = correctCScroll(itemObject);
      if (!scrolls[cs] && character.gold >= parent.G.items[cs].g) {
        scrolls[cs] = [null, 1];
      } else if (scrolls[cs] && (scrolls[cs][0] !== null && 
          character.gold >= parent.G.items[cs].g *
            (scrolls[cs][1] + 1 - character.items[scrolls[cs][0]].q) ||
          scrolls[cs][0] === null && 
            character.gold >= parent.G.items[cs].g * (scrolls[cs][1] + 1))) {
        scrolls[cs][1] += 1;
      } else {
        delete toCompounds[item];
      }
    } else {
      delete toCompounds[item];
    }
  }
  for (let item in toStats) { // add to scrolls
    let index = toStats[item];
    let itemObject = character.items[index];
    if (correctScroll(itemObject) === 'scroll0') {
      if (character.gold >= parent.G.items[statScroll].g) {
        if (!scrolls[statScroll]) {
          scrolls[statScroll] = [null, 1];
        } else {
          scrolls[statScroll][1] += 1;
        }
      } else {
        delete toStats[item];
      }
    } else if (correctScroll(itemObject) === 'scroll1') {
      if (character.gold >= parent.G.items[statScroll].g * 10) {
        if (!scrolls[statScroll]) {
          scrolls[statScroll] = [null, 10];
        } else {
          scrolls[statScroll][1] += 10;
        }
      } else {
        delete toStats[item];
      }
    } else {
      if (character.gold >= parent.G.items[statScroll].g * 100) {
        if (!scrolls[statScroll]) {
          scrolls[statScroll] = [null, 100];
        } else {
          scrolls[statScroll][1] += 100;
        }
      } else {
        delete toStats[item];
      }
    }
  }
  for (let scroll in scrolls) { // buy scrolls
    let scrollArr = scrolls[scroll];
    if (scrollArr[1] > 0 && scrollArr[0] === null) {
      scrollArr[0] = emptySlots.shift();
      buy(scroll, scrollArr[1]);
    } else if (scrollArr[1] > 0) {
      let difference = scrollArr[1] - character.items[scrollArr[0]].q;
      if (difference > 0) {
        buy(scroll, difference);
      }
    }
  }
  wait = true;
  setTimeout(function () {
    wait = false;
    for (let u in toUpgrades) {
      let item = character.items[toUpgrades[u]];
      if (item) {
        upgrade(toUpgrades[u], scrolls[correctScroll(item)][0]);
      }
    }
    for (let c in toCompounds) {
      let cItem = toCompounds[c];
      let item = character.items[cItem[0]];
      if (item) {
        compound(cItem[0], cItem[1], cItem[2], scrolls[correctCScroll(item)][0]);
      }
    }
    for (let s in toStats) {
      upgrade(toStats[s], scrolls[statScroll][0]);
    }
    for (let index of toExchanges) {
      exchange(index);
    }
  }, 500);
}

function playerStrength(player) {
  return (player.attack * player.frequency) + player.armor +
    player.resistance + player.max_hp * 0.5 + player.speed + player.range;
}

var strongEnemy;
function doPVP(targets) {
  var allies = targets.allies;
  var enemies = targets.enemies;
  var injured;
  if (enemies.length > allies.length && !fleeAttempted && 
      character.map !== 'jail') {
    strongEnemy = new Date();
    flee();
    if (character.afk) {
      show_json('Too many enemies: ' + enemies.map(function (e) {
        return e.name;
      }));
    }
    set_message('Too many enemies');      
  } else {
    var strongestEnemy = enemies[0];
    var strongestAlly = allies[0];
    for (let enemy of enemies) {
      if (playerStrength(enemy) > playerStrength(strongestEnemy)) {
        strongestEnemy = enemy;
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
    } else if (playerStrength(strongestAlly) < playerStrength(strongestEnemy) &&
        !fleeAttempted && !fledSuccess() || 
        (character.hp / character.max_hp < 0.5 && allies.length < 2) || rvr) {
      strongEnemy = new Date();
      rvr = character.ctype === 'rogue' && strongestEnemy.ctype === 'rogue';
      flee();
      set_message('Fled from ' + strongestEnemy.name);
      if (character.afk) {
        show_json('Fled from ' + strongestEnemy.name);
      }
    } else if (!strongestEnemy.invincible) {
      attackPlayer(strongestEnemy);
    }
  }
}

function fledSuccess() {
  return character.map === 'jail';
}

var fleeAttempted = false;
var rvr = false;
function flee() {
  fleeAttempted = true;
  if (character.ctype === 'rogue' && (!parent.next_skill.invis ||
      new Date() > parent.next_skill.invis)) {
    invis();
    if (rvr) {
      parent.socket.emit('transport', {to: 'jail'});
    }
  } else {
    parent.socket.emit('transport', {to: 'jail'});
  }
}

function attackPlayer(player) {
  set_message('Attacking ' + player.name);
  if (character.ctype === 'rogue') {
    invis();
  }
  if (character.ctype === 'ranger' && 
      parent.distance(player, character) <= 600) {
    supershot(player);
  } 
  var distParams = canRangeMove(player);
  if (!in_attack_range(player)) {
    if (distParams.canMove || can_move_to(player)) {
      change_target(player);
      if (character.ctype === 'warrior') {
        charge();
        equipShield();
      }
      rangeMove(distParams.dist, distParams.theta, false, true);
    } else {
      game_log('cannot move to player');
    }
  } else if (!player.rip) {
    change_target(player);
    if (character.ctype === 'warrior') {
      equipWeapon();
    }
    if (character.range > player.range) {
      rangeMove(distParams.dist, distParams.theta, true, true);
    }
  }
}

function attackMonster(target) {
  var distParams = canRangeMove(target);
  if (!target || (!distParams.canMove && !can_move_to(target) && 
      !in_attack_range(target) || target.dead)) {
    set_message('No monsters');
  } else {
    if (character.ctype === 'ranger' && (useAbilities === true ||
        useAbilities !== false && useAbilities <= target.max_hp)) {
      supershot(target);
    } 
    set_message('Attacking ' + target.mtype);
    change_target(target);
    if (target && !target.dead && !target.rip) {
      rangeMove(distParams.dist, distParams.theta, 
                priorityMonsters.includes(target.mtype) && solo && 
                  character.range > 50);
    }
  }
}

function attackLoop() {
  var t = get_target();
  if (!t || t.dead || t.rip || 
      character.invis && strongEnemy && new Date() - strongEnemy <= 60000 && 
        !fleeAttempted ||
      character.invis && character.hp / character.max_hp < 0.9) {
    return;
  }
  if (t && t.type === 'character' && !party.includes(t.name) ||
      t && t.type === 'monster' && (useAbilities === true ||
        useAbilities !== false && useAbilities <= t.max_hp)) {
    useAbilityOn(t);
  }
  if (t && party.includes(t.name) && character.ctype === 'priest') {
    if (t.hp / t.max_hp <= healAt) {
      heal(t);
    }
  } else if (t && !t.dead && !t.rip && in_attack_range(t) && 
      !party.includes(t.name)) {
    attack(t);
  }
}

function useAbilityOn(target) {
  if (character.ctype === 'rogue') {
    invis();
  } else if (!target || target.dead || target.rip) {
    return;
  } else if (character.ctype === 'warrior') {
    taunt(target);
  } else if (character.ctype === 'ranger') {
    supershot(target);
  } else if (character.ctype === 'priest') {
    curse(target);
  } else if (character.ctype === 'mage') {
    burst(target);
  }
}

function healPlayer(target) {
  set_message('Healing ' + target.name);
  change_target(target);
  var distParams = canRangeMove(target);
  if (!in_attack_range(target) && (distParams.canMove || can_move_to(target))) {
    rangeMove(distParams.dist, distParams.theta);
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
    fleeAttempted = false;
    parent.socket.emit("ability", {
      name: "invis"
    });
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
    for (let i = character.items.length; i >= 0; i--) {
      if (character.items[i] && character.items[i].name === 'shield') {
        equip(i);
      }
    }
  }
}

function equipWeapon() {
  if (character.slots['offhand'] !== null) {
    parent.socket.emit('unequip', {slot: 'offhand'});
  }
  if (character.slots['offhand'] === null) {
    for (let i = character.items.length; i >= 0; i--) {
      if (character.items[i] && character.items[i].name === 'blade') {
        equip(i);
      }
    }
  }
}

function supershot(target) {
  if ((!parent.next_skill.supershot || 
      new Date() > parent.next_skill.supershot) && character.mp >= 400) {
    lastsupershot = new Date();
    buy('mpot0', 1);
    parent.socket.emit("ability", {
      name: "supershot",
      id: target.id
    });
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

function main() { // move and attack code
  if (character.rip) return;
  potions();
  loot();
  loopAddition();
  if (!doAttack) return;
  if (character.invis && strongEnemy && 
      new Date() - strongEnemy < 60000) return;
  if (fledSuccess() || 
        strongEnemy && new Date() - strongEnemy > 60000) {
    fleeAttempted = false;
    if (rvr) {
      change_target(get_nearest_monster());
    }
    rvr = false;
  }
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
  } else {
    set_message('No targets.');
  }
}

setCorrectingInterval(uceItem, 1000);
setCorrectingInterval(attackLoop, 1000 / character.frequency + attackLoopDelay);
setCorrectingInterval(main, loopInterval);
