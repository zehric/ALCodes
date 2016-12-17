//Credit for correctingInterval goes to JourneyOver 'http://tiny.cc/MyFunctions'
window.setCorrectingInterval = (function(func, delay) {
  var instance = {};

  function tick(func, delay) {
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
  return {
    clear: function() {
      tick = null;
    }
  };
});

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

// function tryAttack(target) {
//   if (target && !target.dead && !target.rip && can_attack(target)) {
//     attack(target);
//   }
// }

function rangeMove(target) {
  var dX = target.real_x - character.real_x;
  var dY = target.real_y - character.real_y;
  var dist = Math.hypot(dX, dY) - character.range;
  var theta = Math.atan2(dY, dX);
  var newX = character.real_x + dist * Math.cos(theta);
  var newY = character.real_y + dist * Math.sin(theta);
  if (!in_attack_range(target)) {
    move(newX, newY);
  } else if (kite) {
    var farX = character.real_x + (dist - 60) * Math.cos(theta);
    var farY = character.real_y + (dist - 60) * Math.sin(theta);
    while (!can_move_to(farX, farY) && theta < 100) {
      theta += 1.5;
      farX = character.real_x + (dist - 60) * Math.cos(theta);
      farY = character.real_y + (dist - 60) * Math.sin(theta);
      newX = character.real_x + dist * Math.cos(theta);
      newY = character.real_y + dist * Math.sin(theta);
    }
    move(newX, newY);
  }
}

function getBestMonster(maxHP, minXP, currentTarget) {
  if (currentTarget && (!currentTarget.target 
      || currentTarget.target === character.name)) {
    return currentTarget;
  }
  var target = null;
  for (id in parent.entities) {
    var current = parent.entities[id];
    if (priorityMonsters.includes(current.mtype) && 
        (tanks.includes(current.target) || solo)) {
      return current;
    }
    if (can_move_to(current) &&
        (!current.target || party.includes(current.target)) &&
        current.type === 'monster' && !current.dead && 
        current.max_hp <= maxHP && current.xp >= minXP && 
        ((target == null || 
            current.xp / current.max_hp > target.xp / target.max_hp) ||
        target.mtype === current.mtype &&
            parent.distance(character, current) <
                parent.distance(character, target))) {
      target = current;
    }
  }
  return target;
}

function findPlayers() {
  players = []
  for (id in parent.entities) {
    var current = parent.entities[id];
    if (current.type === 'character' && !current.rip && 
        !party.includes(current.name)) {
      players.push(current);
    }
  }
  return players;
}

function potions() {
  if (new Date() > parent.next_potion) {
    if (character.hp < 400) {
      buy('hpot0', 1);
    } else if (character.mp < 100) {
      buy('mpot0', 1);
    }
    if (character.max_hp - character.hp > useHP) {
      parent.use('hp');
    } else if (character.max_mp - character.mp > useMP) {
      parent.use('mp');
    }
  }
}

var buyable = ['coat', 'gloves', 'helmet', 'bow', 'pants', 'shoes', 'blade', 
               'claw', 'staff'];
var primaryStats = { warrior: 'str', ranger: 'dex', rogue: 'dex', mage: 'int',
                     priest: 'int' };
var statScroll = primaryStats[character.ctype] + 'scroll';
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
  if (upgradeItems && upgradeItems.length > 0) {
    for (let name of upgradeItems) {
      for (let i = 0; i < character.items.length; i++) {
        if (character.items[i] && character.items[i].name === name) {
          toUpgrades[name] = i;
        }
      }
      if (!toUpgrades[name] && buyable.includes(name)) {
        toUpgrades[name] = true;
      }
    }
  } else {
    for (let slot in character.slots) {
      let item = character.slots[slot];
      if (item && buyable.includes(item.name) && item.level < upgradeTo) {
        toUpgrades[item.name] = true;
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

  for (let item in toUpgrades) { // buy items and add to scrolls
    let index = toUpgrades[item];
    if (typeof(index) !== 'number') {
      toUpgrades[item] = emptySlots.shift();
      if (character.gold >= parent.G.items[item].g) {
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
      if (scrolls[s] && scrolls[s][0] 
          || character.gold >= parent.G.items[s].g) {
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
      if (scrolls[cs] && scrolls[cs][0] 
          || character.gold >= parent.G.items[cs].g) {
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
    if (scrollArr[1] > 0 && !scrollArr[0]) {
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
      upgrade(toUpgrades[u], scrolls[correctScroll(item)][0]);
    }
    for (let c in toCompounds) {
      let cItem = toCompounds[c];
      let item = character.items[cItem[0]];
      compound(cItem[0], cItem[1], cItem[2], scrolls[correctCScroll(item)][0]);
    }
    for (let s in toStats) {
      upgrade(toStats[s], scrolls[statScroll][0]);
    }
    for (let index of toExchanges) {
      exchange(index);
    }
  }, 200);
}


var attackInterval;

setCorrectingInterval(function() { // enchant code
  if (autoUCE) {
    uceItem();
  }
}, 1000);

setCorrectingInterval(function() { // move and attack code
  potions();
  loot();
  if (!doAttack) return;
  var target = get_target();
  if (target && (target.dead || target.rip)) {
    target = null;
    if (attackInterval) {
      attackInterval.clear();
      attackInterval = null;
    }
  }
  target = getBestMonster(maxMonsterHP, minMonsterXP, target);
  if (!target || !can_move_to(target) || target.dead) {
    set_message('No monsters');
    return;
  } else {
    change_target(target);
  }
  if (target && !attackInterval) {
    set_message('Attacking ' + target.mtype);
    attackInterval = setCorrectingInterval(function () {
      var t = get_target();
      if (!t.dead && !t.rip && can_attack(t)) {
        attack(get_target());
      }
    }, 1 / character.frequency);
  }
  if (target && !target.dead && !target.rip) {
    rangeMove(target);
  }
}, 100);
