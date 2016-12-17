doAttack = true;
kite = true;
autoUCE = true; // auto upgrade/compound/exchange
upgradeTo = 7;
upgradeItems = []; // if this is not empty, will only upgrade specific type
                       // ie. 'claw', 'staff', etc. Item needs to be in inv, 
                       // if not buyable from a merchant. Otherwise, will
                       // try to upgrade everything

party = ['Tools', 'Glass', 'Toolss', 'bleevl', 'bleevlsss', 'AidElk', 
             'Edylc', 'LeonXu', 'LeonXu2', 'LeonXu4', 'iloveyou56', 'nopo',
             'bleeeeevl'];

useHP = 200;
useMP = 300;
// use hpot or mpot when lacking this much

useAbilities = false; // in pve
maxMonsterHP = 5000;
minMonsterXP = 500;

priorityMonsters = ['mvampire'];
// use for strong mobs that need a party to kill, in no particular order
solo = false; // try to solo the priority monster

tanks = ['bleevl'];
// if not empty, only attacks priority monsters that are targeting listed tanks

setTimeout(function() {

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
      console.log('entered');
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
  
}, 500);

$.getScript('https://rawgit.com/zehric/ALCodes/master/functions.js');
