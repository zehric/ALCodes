var upgradeTo = 8;
var upgradeItems = [];


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
        if (character.items[i].name === name) {
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
    } else if (toUpgrades[item.name]) { // remove if > upgradeTo
      // add to stats if doesn't have a stat
      if (!item.stat_type && parent.G.items[item.name].stat) {
        toStats[item.name] = i;
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
    } else if (parent.G.items[item.name].upgrade) { // autoequip
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
        console.log('buying ' + item + ' in index ' + toUpgrades[item]);
        // buy(item, 1);
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
      if (character.gold >= parent.G.items[s].g) {
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
      if (character.gold >= parent.G.items[cs].g) {
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
      console.log('buying ' + scrollArr[1] + ' ' + scroll + ' in index ' + scrollArr[0]); 
      // buy(scroll, scrollArr[1]);
    } else if (scrollArr[1] > 0) {
      let difference = scrollArr[1] - character.items[scrollArr[0]].q;
      if (difference > 0) {
        console.log('buying ' + difference + ' ' + scroll + ' in index ' + scrollArr[0]); 
        // buy(scroll, difference);
      } else console.log('did not need to buy any ' + scroll);
    }
  }
  console.log('Second pass-through:');
  console.log(toUpgrades); //
  console.log(toStats); //
  console.log(toCompounds); //
  console.log(scrolls);
  console.log(emptySlots);
  console.log(toExchanges);

  for (let u in toUpgrades) {
    let item = character.items[toUpgrades[u]];
    console.log('upgrading ' + item.name + ' with ' + correctScroll(item));
    //upgrade(toUpgrades[u], scrolls[correctScroll(item)]);
  }
  for (let c in toCompounds) {
    let cItem = toCompounds[c];
    let item = character.items[cItem[0]];
    console.log('upgrading ' + item.name + ' with ' + correctCScroll(item));
    //compound(cItem[0], cItem[1], cItem[2], scrolls[correctCScroll(item)]);
  }
  for (let s in toStats) {
    console.log('upgrading ' + s + ' with ' + statScroll);
    //upgrade(toStats[s], scrolls[statScroll]);
  }
  for (let index of toExchanges) {
    console.log('exchanging ' + character.items[index].name);
    //exchange(index);
  }
}

uceItem();
