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
  return { clear: function() {
      stopped = true;
  } };
});

var rangeAdjust = (character.range >= 40) ? 25 : 0;

function showTransports(e) {
  if (e.keyCode === 113) {
    parent.socket.emit('transport', {to: 'bank'});
  } else if (e.keyCode === 16) {
    parent.render_transports_npc();
  } else if (e.keyCode === 192) {
    parent.socket.emit('transport', {to: 'jail'});
  }
}

parent.window.addEventListener('keydown', showTransports);

on_destroy = function () {
  parent.window.removeEventListener('keydown', showTransports);
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

function canRangeMove(target) {
  if (!target || target.dead || target.rip) {
    return false;
  }
  var dX = target.real_x - character.real_x;
  var dY = target.real_y - character.real_y;
  var dist = Math.hypot(dX, dY) - character.range - rangeAdjust;
  var theta = Math.atan2(dY, dX);
  var newX = character.real_x + dist * Math.cos(theta);
  var newY = character.real_y + dist * Math.sin(theta);
  if (can_move_to(newX, newY)) {
    return { dist: dist, theta: theta };
  } else {
    return false;
  }
}

function rangeMove(dist, theta) {
  var newX = character.real_x + dist * Math.cos(theta);
  var newY = character.real_y + dist * Math.sin(theta);
  if (dist > character.range + rangeAdjust) {
    move(newX, newY);
  } else if (kite) {
    var farX = character.real_x + (dist - wallKiteRange) * Math.cos(theta);
    var farY = character.real_y + (dist - wallKiteRange) * Math.sin(theta);
    var counter = 1;
    while ((!can_move_to(farX, farY) || !can_move_to(newX, newY) || 
        (xBoundaries.length && (newX < xBoundaries[0] || 
          newX > xBoundaries[1]) ||
        (yBoundaries.length && (newY < yBoundaries[0] || 
          newY > yBoundaries[1])))) && theta < 16 && theta > -16) {
      if (counter % 2 === 1) {
        theta += 0.2 * counter;
      } else {
        theta -= 0.2 * counter;
      }
      farX = character.real_x + (dist - wallKiteRange) * Math.cos(theta);
      farY = character.real_y + (dist - wallKiteRange) * Math.sin(theta);
      newX = character.real_x + dist * Math.cos(theta);
      newY = character.real_y + dist * Math.sin(theta);
      counter++;
    }
    move(newX, newY);
  }
}

function searchTargets(maxHP, minXP, currentTarget) {
  if (currentTarget && !party.includes(currentTarget.name) && (!parent.pvp &&
        (!currentTarget.target || party.includes(currentTarget.target)) || 
        (parent.pvp && currentTarget.type === 'character')) && 
      character.ctype !== 'priest' && 
      (parent.distance(currentTarget, character) <= character.range + 50 || 
        currentTarget.target === character.name)) {
    return currentTarget;
  }
  var target = null;
  var enemies = [];
  var allies = [];
  for (let id in parent.entities) {
    let current = parent.entities[id];
    if (parent.pvp && current.type === 'character' && !current.rip &&
        !current.npc && (canRangeMove(current) || 
          parent.distance(character, current) <= current.range + 100 ||
          current.ctype === 'ranger')) {
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
        return current;
      } else {
        continue;
      }
    }
    if (canRangeMove(current) && (!target || target.type !== 'character') &&
        (!current.target || party.includes(current.target)) &&
        current.type === 'monster' && !current.dead && 
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
      parent.G.monsters[t.mtype].range)) {
    set_message('Fled from ' + t.mtype || t.name);
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
    target.npc || (target.type === 'monster' && 
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
function uceItem() {
  function correctScroll(item) {
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
    } else if (toUpgrades[item.name] && item.level < upgradeTo) { 
      // add to upgrades
      toUpgrades[item.name] = i;
    } else if (toUpgrades[item.name] && item.level >= upgradeTo) { 
      // remove if > upgradeTo
      // add to stats if doesn't have a stat
      if (!item.stat_type && parent.G.items[item.name].stat) {
        toStats[item.name] = i;
      } else { // autoequip
        for (let slot in character.slots) {
          let equipped = character.slots[slot];
          if (equipped && equipped.name === item.name && 
              equipped.level < item.level && 
              equipped.stat_type === item.stat_type) {
            parent.socket.emit('unequip', {slot: slot});
            setTimeout(function () { equip(i); }, 500);
            break;
          }
        }
      }
      delete toUpgrades[item.name];
    } else if (upgradeItems[item.name] && 
        item.level < upgradeItems[item.name]) {
      toUpgrades[item.name] = i;
    } else if (upgradeItems[item.name] && 
        item.level >= upgradeItems[item.name]) {
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

  for (let item in toUpgrades) { // buy items and add to scrolls
    let index = toUpgrades[item];
    if (typeof(index) !== 'number') {
      if (character.gold >= parent.G.items[item].g && 
          (scrolls['scroll0'] || 
            character.gold >= parent.G.items[item].g + 1000)) {
        toUpgrades[item] = emptySlots.shift();
        buy(item, 1);
        if (!scrolls['scroll0']) {
          scrolls['scroll0'] = [null, 1];
        } else {
          scrolls['scroll0'][1] += 1;
        }
      } else {
        delete toUpgrades[item];
      }
    } else {
      let itemObject = character.items[index];
      let s = correctScroll(itemObject);
      if (scrolls[s] && scrolls[s][0] !== null && 
            character.gold >= parent.G.items[s].g *
          (scrolls[s][1] - character.items[scrolls[s][0]].q) || !scrolls[s] &&
          character.gold >= parent.G.items[s].g) {
        if (!scrolls[s]) {
          scrolls[s] = [null, 1];
        } else {
          scrolls[s][1] += 1;
        }
      } else {
        delete toUpgrades[item];
      }
    }
  }
  for (let item in toCompounds) { // add to scrolls
    let indices = toCompounds[item];
    if (indices.length === 3) {
      let itemObject = character.items[indices[0]];
      let cs = correctCScroll(itemObject);
      if (scrolls[cs] && scrolls[cs][0] !== null && character.gold >= 
            parent.G.items[cs].g *
          (scrolls[cs][1] - character.items[scrolls[cs][0]].q) || 
            !scrolls[cs] && character.gold >= parent.G.items[cs].g) {
        if (!scrolls[cs]) {
          scrolls[cs] = [null, 1];
        } else {
          scrolls[cs][1] += 1;
        }
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
    } else {
      if (character.gold >= parent.G.items[statScroll].g * 10) {
        if (!scrolls[statScroll]) {
          scrolls[statScroll] = [null, 10];
        } else {
          scrolls[statScroll][1] += 10;
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
  setTimeout(function () {
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
    player.resistance + player.max_hp + player.speed + player.range;
}

function doPVP(targets) {
  var allies = targets.allies;
  var enemies = targets.enemies;
  if (targets.enemies.length > targets.allies.length) {
    set_message('Too many enemies');
    flee();
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
    }
    if (playerStrength(strongestAlly) < playerStrength(strongestEnemy)) {
      set_message('Fled from ' + strongestEnemy.name);
      flee();
    } else {
      attackPlayer(strongestEnemy);
    }
  }
}

var strongEnemy;
function flee() {
  strongEnemy = new Date();
  if (character.ctype === 'rogue' && (!parent.next_skill.invis ||
      new Date() > parent.next_skill.invis)) {
    invis();
  } else {
    parent.socket.emit('transport', {to: 'jail'});
  }
}

function attackPlayer(player) {
  set_message('Attacking ' + player.name);
  if (character.ctype === 'rogue') {
    invis();
  }
  if (character.ctype === 'ranger') {
    supershot(target);
  } 
  var distParams = canRangeMove(player);
  if (!in_attack_range(player)) {
    if (distParams) {
      change_target(player);
      if (character.ctype === 'warrior') {
        charge();
      }
      rangeMove(distParams.dist, distParams.theta);
    } else {
      game_log('cannot move to player');
    }
  } else if (!player.rip) {
    change_target(player);
    if (character.ctype === 'warrior') {
      charge();
    }
    if (!attackInterval) {
      attackInterval = setCorrectingInterval(attackLoop,
        1000 / character.frequency + attackLoopDelay);
    }
    if (character.range > player.range && distParams) {
      rangeMove(distParams.dist, distParams.theta);
    }
  }
}

function attackMonster(target) {
  var distParams = canRangeMove(target);
  if (!target || (!distParams && !in_attack_range(target) || 
      target.dead)) {
    set_message('No monsters');
  } else {
    if (character.ctype === 'ranger' && useAbilities) {
      supershot(target);
    } 
    set_message('Attacking ' + target.mtype);
    change_target(target);
    if (target && !attackInterval && !target.dead && !target.rip && 
        can_attack(target)) {
      attackInterval = setCorrectingInterval(attackLoop, 
        1000 / character.frequency + attackLoopDelay);
    }
    if (target && !target.dead && !target.rip) {
      rangeMove(distParams.dist, distParams.theta);
    }
  }
}

function attackLoop() {
  var t = get_target();
  if (t && t.type === 'character' && !party.includes(t.name) || useAbilities) {
    useAbilityOn(t);
  }
  if (t && party.includes(t.name) && character.ctype === 'priest') {
    heal(t);
  } else if (t && !t.dead && !t.rip && in_attack_range(t)) {
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
  if (!in_attack_range(target) && distParams) {
    rangeMove(distParams.dist, distParams.theta);
  } else if (can_heal(target) && !attackInterval) {
    attackInterval = setCorrectingInterval(attackLoop, 
      1000 / character.frequency + attackLoopDelay);
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

function supershot(target) {
  if (!parent.next_skill.supershot || 
      new Date() > parent.next_skill.supershot) {
    lastsupershot = new Date();
    buy('mpot1', 1);
    parent.socket.emit("ability", {
      name: "supershot",
      id: target.id
    });
  }
}

setCorrectingInterval(function() { // enchant code
  if (autoUCE) {
    uceItem();
  }
}, 1000);

var attackInterval;
setCorrectingInterval(function() { // move and attack code
  potions();
  loot();
  if (!doAttack) return;
  if (character.invis && strongEnemy && 
      new Date() - strongEnemy < 60000) return;
  var target = get_target();
  if (target && (target.dead || target.rip)) {
    target = null;
    parent.ctarget = null;
  }
  target = searchTargets(maxMonsterHP, minMonsterXP, target);
  if (!in_attack_range(target) && new Date() > parent.next_attack && 
      attackInterval) {
    attackInterval.clear();
    attackInterval = null;
  }
  if (in_attack_range(target) && pocket && get_player(pocket)) {
    var p = get_player(pocket);
    move(p.real_x, p.real_y);
  }
  if (target && target.players) {
    doPVP(target);
  } else if (target && target.type === 'character' && party.includes(target.name)) {
    healPlayer(target);
  } else if (target && target.type === 'character') {
    attackPlayer(target);
  } else {
    attackMonster(target);
  }
}, loopInterval);
