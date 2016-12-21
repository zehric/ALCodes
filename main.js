/* General Config */
doAttack = character.ctype !== 'merchant';
kite = character.range > 50 && true; // false to manually override no kiting

wallKiteRange = 100; // stay this distance away from walls when kiting

autoUCE = true; // auto upgrade/compound/exchange
upgradeTo = 7; // for all currently worn equips
// if true, upgrade everything currently wearing below upgradeTo that can be 
// bought
upgradeAll = true; 
// additional items to upgrade including desired level. will not auto-stat
upgradeItems = { 
  'xmassweater': 6,
  'mittens': 6
}; 

// don't go past these coordinates when kiting
xBoundaries = []; 
yBoundaries = []; 

party = ['Tools', 'Glass', 'Toolss', 'bleevl', 'bleevlsss', 'AidElk', 
         'Edylc', 'LeonXu', 'LeonXu2', 'LeonXu4', 'iloveyou56', 'nopo',
         'bleeeeevl'];

// use hpot or mpot when lacking this much
useHP = 200;
useMP = 300;

// buy a pot when below these values
buyHPPotAt = character.max_hp - 200;
buyMPPotAt = 100;

useAbilities = false; // in pve
maxMonsterHP = 5000;
minMonsterXP = 500;

// use for strong mobs that need a party to kill, in no particular order
priorityMonsters = ['mvampire'];
solo = false; // try to solo the priority monster

// if not empty, only attacks priority monsters that are targeting those listed
tanks = ['bleevl'];

loopInterval = 200; // increase this if you are disconnecting
attackLoopDelay = 30; // increase this if your attacks are missing often

/* Priest Config */
healAt = 0.7;
pocket = ''; // who to follow when healing

$.getScript('https://rawgit.com/zehric/ALCodes/master/functions.js');
