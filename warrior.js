var attack_mode = true
var kite = false
var max_monster_hp = 130000
var min_monster_xp = 1500

var whitelist = ['gem1', 'armorbox', 'weaponbox']
var priority_monster = 'skeletor'

var party = ['Tools', 'Glass', 'bleevl', 'bleevlsss', 'AidElk', 'Edylc',
             'LeonXu', 'LeonXu2']

var party_online = party.filter(function (person) {
  return get_player(person)
})

on_party_invite = function (name) {
  if (party.includes(name)) {
    accept_party_invite(name)
  }
}

for (let i = 0; i < people.length; i++) {
  if (parent.party_list.indexOf(people[i]) == -1) {
    send_party_invite(people[i])
  }
}

function main() {
  potions()
  loot()

  if (!attack_mode) {
   return
  }

  var target = get_targeted_monster()
  if (!target) {
   target = get_best_monster(max_monster_hp, min_monster_xp)
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
  if (kite || !in_attack_range(target)) {
   move(character.real_x + dist * Math.cos(theta),
        character.real_y + dist * Math.sin(theta))
  }
  if (can_attack(target)) {
   set_message("Attacking")
   attack(target)
  }
}

function potions() {
  if (new Date() < parent.next_potion) return;
  if (character.max_hp - character.hp > 500) {
		parent.use('hp')
	} else if (character.max_mp - character.mp > 100) {
    parent.use('mp')
  }
}

function exchangeItem() {
  for (let i = 0; i < character.items.length; i++) {
    let c = character.items[i]
    if (c && whitelist.includes(c.name)) {
      exchange(i)
      parent.e_item = i
    }
  }
}

function get_best_monster(max_hp, min_xp) {
  var target = null
  for (id in parent.entities) {
    var current = parent.entities[id]
    if (current.mtype === priority_monster) {
      target = current
      break
    }
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
