/* General Config */
doAttack = character.ctype !== 'merchant';
kite = character.range > 50 && true; // false to manually override no kiting
alwaysFight = false; // always fight in PvP, no matter the odds

wallKiteRange = 60; // stay this distance away from walls when kiting

autoUCE = true; // auto upgrade/compound/exchange
autoExchange = true;
forceUpgrade = false; // force upgrade even if you have high level equipped
upgradeTo = 7; // for all currently worn equips
// if true, upgrade everything currently wearing below upgradeTo (if buyable)
upgradeAll = true; 
// additional items to upgrade including desired level.
upgradeItems = { 
  'xmassweater': 6,
  'mittens': 6
}; 
sell = ['hpamulet']; // list of items to sell to vendor

// don't go past these coordinates when kiting / targeting a mob
xBoundaries = []; 
yBoundaries = []; 

// if this much away from save location, return to save location
returnDistance = Infinity; 

party = [];

fleeList = []; 

// use hpot or mpot when lacking this much
useHP = 250;
useMP = character.max_mp - 200;

useAbilities = 10000; // in pve
maxMonsterHP = 2500;
minMonsterXP = 2000;
maxMonsterDistance = Infinity; 
pathfindTo = true;

// use for strong mobs that need a party to kill, in no particular order
priorityMonsters = ['mvampire'];
solo = false; // try to solo the priority monster

// if not empty, only attacks priority monsters that are targeting those listed
tanks = [];

loopInterval = 200; // increase this if you are disconnecting
attackLoopDelay = 30; // increase this if your attacks are missing often

loopAddition = function () {
  // put any logic you want to add to the main loop here
};

/* Priest Config */
healAt = 0.7;
pocket = ''; // who to follow when healing

$.getScript('https://cdn.rawgit.com/qiao/heap.js/master/lib/heap.js', function () {
  $.getScript('https://cdn.rawgit.com/zehric/6bcb8e8963c74cc2b2b6dcc270d18411/raw/35597c220d6ac87d9deae2ccfec8bef7c9560159/pathfinding.js', function () {
    $.getScript('https://rawgit.com/zehric/35c89f213fa5c4b564438dd70f40118f/raw/functions.js');
  });
});
