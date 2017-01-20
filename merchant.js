// examples: dex, str, int. Or, if equal to '*', include all items in inventory. 
// set to false to not buy or sell. set to 'compound' to include all
// compoundable items.
var sellKeyword = '*';
var buyKeyword = false; 

setInterval(function () {
  if (sellKeyword && character.slots['trade1'] !== undefined) {
    var freeSlot = 1;
    for (let i = character.items.length; (i >= 0 && freeSlot <= 
        ((character.slots['trade5'] !== undefined) ? 16 : 4)); i--) {
      let item = character.items[i];
      if (item && !character.slots['trade' + freeSlot] && 
          !item.name.includes('stand') &&
          (sellKeyword === '*' || item.name.includes(sellKeyword) || 
          parent.G.items[item.name][sellKeyword])) {
        parent.trade('trade' + freeSlot, i, 1, item.q);
        freeSlot++;
      } else if (character.slots['trade' + freeSlot]) {
        freeSlot++;
      }
    }
  }

  if (buyKeyword) {
    for (var id in parent.entities) {
      let current = parent.entities[id];
      if (current && current.type === 'character' && 
          current.slots['trade1'] !== undefined) {
        for (let i = 1; i <= ((current.slots['trade5'] !== undefined) ? 16 : 4);
            i++) {
          let item = current.slots['trade' + i];
          if (item && item.price < 1000 && (buyKeyword === '*' || 
              item.name.includes(buyKeyword) || 
              parent.G.items[item.name][buyKeyword])) {
            let slot = 'trade' + i;
            parent.trade_buy(slot, current.id, item.rid, item.q);
          }
        }
      }
    }
  }
}, 1000);

