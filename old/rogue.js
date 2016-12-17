var attack_mode = true
var kite = true
var attack_maxHP_only = false
var max_monster_hp = 4000
var min_monster_xp = 500

var doUpgrade = true;
var emaxlevel = 6;
var upItem = "staff";
var goldThresh = 1000000;

var whitelist = ['gem1', 'armorbox', 'weaponbox']
var priority_monster = 'skeletor'

var party = ['Tools', 'Glass', 'Toolss', 'bleevl', 'bleevlsss', 'AidElk', 
             'Edylc', 'LeonXu', 'LeonXu2', 'LeonXu4', 'iloveyou56', 'nopo',
             'bleeeeevl']

var party_online = party.filter(function (person) {
  return get_player(person)
})

on_party_invite = function (name) {
  if (party.includes(name)) {
    accept_party_invite(name)
  }
}

on_party_request = function (name) {
  if (party.includes(name)) {
    accept_party_request(name)
  }
}

for (let i = 0; i < party.length; i++) {
  if (!parent.party_list.includes(party[i])) {
    send_party_invite(party[i])
  }
}

var lastThreat
function main() {
  potions()
  loot()
  exchangeItem()
  if (doUpgrade && character.gold > goldThresh) {
    upgrade(emaxlevel);
  }
  if (!attack_mode) {
    return
  }

  var players = checkPlayers()
  var target = get_target()
  if (!target || target.dead || target.rip) {
    if (players.length === 1 && players[0].hp < 900 
        && new Date() - lastThreat > 300000) {
      target = players[0]
    } else if (players.length === 0 
               && (new Date() - lastThreat > 300000 || !lastThreat)) {
      target = get_best_monster(max_monster_hp, min_monster_xp)
    } else {
      target = null
      lastThreat = new Date()
    }
    if (target) {
      change_target(target)
    } else {
      set_message("No Monsters")
      return
    }
  }
  


  var dX = target.real_x - character.real_x
  var dY = target.real_y - character.real_y
  var dist = Math.hypot(dX, dY) - character.range + 3
  var theta = Math.atan2(dY, dX)
  // if (in_attack_range(target) && target.attack >= 200) {
	  // theta += Math.PI/3
  // }
  if (kite || !in_attack_range(target)) {
    move(character.real_x + dist * Math.cos(theta),
         character.real_y + dist * Math.sin(theta))
  }
  if (can_attack(target)) {	
    set_message("Attacking")
    attack(target)
  }
}

function exchangeItem() {
  for (let i = 0; i < character.items.length; i++) {
    let c = character.items[i];
    if (c && whitelist.includes(c.name)) {
      exchange(i)
      parent.e_item = i;
    }
  }
}

var lastinvis
function invis() {
  if (!lastinvis || new Date() - lastinvis > 12000) {
    lastinvis = new Date()
    parent.socket.emit("ability", {
      name: "invis",
    })
  }
}

function checkPlayers() {
  players = []
  for (id in parent.entities) {
    var current = parent.entities[id]
    if (current.type === 'character' && !current.rip && !party.includes(current.name)) {
      invis()
      players.push(current)
    }
  }
  return players
}

function potions() {
  if (new Date() < parent.next_potion) return;
  if (character.max_hp - character.hp > 200) {
		parent.use('hp')
	} else if (character.max_mp - character.mp > 300) {
    parent.use('mp')
  }
}

function get_best_monster(max_hp, min_xp) {
  var target = null
  for (id in parent.entities) {
    var current = parent.entities[id]
    if (current.mtype === priority_monster && current.target === 'bleevl') {
      target = current
      break
    }
    if (attack_maxHP_only && current.hp >= current.max_hp) continue;
    if (current.type != "monster" || current.dead || !can_move_to(current)) continue;
    if (current.max_hp > max_hp || current.xp < min_xp) continue;
    if (target == null || current.xp / current.max_hp > target.xp / target.max_hp) {
      target = current
    }
    if (target.mtype === current.mtype
        && parent.distance(character, current) < parent.distance(character, target)) {
          target = current
    }
  }
  return target
}
setInterval(main, 1600/8);
