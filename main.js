var doAttack = true;
var kite = true;
var autoUpgrade = true;
var autoCompound = true;
var autoExchange = true;
var upgradeTo = 7;
var upgradeItems = []; // if this is not empty, will only upgrade specific type
                       // ie. 'claw', 'staff', etc. Item needs to be in inv, 
                       // if not buyable from a merchant. Otherwise, will
                       // try to upgrade everything

var party = ['Tools', 'Glass', 'Toolss', 'bleevl', 'bleevlsss', 'AidElk', 
             'Edylc', 'LeonXu', 'LeonXu2', 'LeonXu4', 'iloveyou56', 'nopo',
             'bleeeeevl'];

var useHP = 200;
var useMP = 300;
// use hpot or mpot when lacking this much

var useAbilities = false; // in pve
var maxMonsterHP = 5000;
var minMonsterXP = 500;

var priorityMonsters = ['mvampire'];
// use for strong mobs that need a party to kill, in no particular order
var solo = false; // try to solo the priority monster

var tanks = ['bleevl'];
// if not empty, only attacks priority monsters that are targeting listed tanks

setTimeout(function() {

  var attackInterval;

  setCorrectingInterval(function() { // enchant code
    uceItem();
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
    if (!target) {
      target = getBestMonster(maxMonsterHP, minMonsterXP);
      if (!target || !can_move_to(target) || target.dead) {
        set_message('No monsters');
        return;
      } else {
        change_target(target);
      }
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


