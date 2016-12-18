/* General Config */
doAttack = character.ctype !== 'merchant';
kite = character.range > 50 && true; // false to manually override no kiting
autoUCE = true; // auto upgrade/compound/exchange
upgradeTo = 7;
upgradeItems = []; // if empty, will upgrade everything you are wearing
                   // that can be bought

xBoundaries = []; 
yBoundaries = []; 
// don't go past these coordinates when kiting

party = ['Tools', 'Glass', 'Toolss', 'bleevl', 'bleevlsss', 'AidElk', 
         'Edylc', 'LeonXu', 'LeonXu2', 'LeonXu4', 'iloveyou56', 'nopo',
         'bleeeeevl'];

useHP = 200;
useMP = 300;
// use hpot or mpot when lacking this much

buyHPPotAt = character.max_hp / 3;
buyMPPotAt = 100;
// buy a pot when below these values

useAbilities = false; // in pve
maxMonsterHP = 5000;
minMonsterXP = 500;

priorityMonsters = ['mvampire'];
// use for strong mobs that need a party to kill, in no particular order
solo = false; // try to solo the priority monster

tanks = ['bleevl'];
// if not empty, only attacks priority monsters that are targeting those listed

loopInterval = 100; // increase this if you are disconnecting

/* Priest Config */
healAt = 0.7;

$.getScript('https://rawgit.com/zehric/ALCodes/master/functions.js');
