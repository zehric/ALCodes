// for xmas items
var freeSlot = 4;
var nextIdx = -1;

setInterval(function () {
  for (let i = character.items.length; i >= 0; i--) {
    if (character.items[i] && character.items[i].name.includes('xmas')) {
	  nextIdx = i;
	  break;
    }
  }
  if (nextIdx !== -1) {
	trade(nextIdx, freeSlot, 225001);
  }
}, 1000);
