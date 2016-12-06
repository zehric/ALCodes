var attack_mode = false
var heal_mode = true
var kite = true

var people = parent.party_list

on_party_invite = function (name) {
  if (name === "Glass") accept_party_invite(name)
  people = parent.party_list
}

function main() {
  potions()
  loot()

  if (!attack_mode && !heal_mode) {
    return
  }
  var target

  if (attack_mode) {
    target = get_targeted_monster()
    if (!target) {
      target = get_best_monster(4000, 1500)
      if (target) {
        change_target(target)
      } else {
        set_message("No Monsters")
        return
      }
    }
    if (target && get_target_of(target) && in_attack_range(target) && get_target_of(target).party == character.party) {
      curse(target)
      set_message("Cursing " + target.mtype)
    }
    // if (can_attack(target)) {	
    //   set_message("Attacking " + target.mtype)
    //   attack(target)
    // }
  }

  if (heal_mode) {
    target = get_player(people[0])
    for (let name of people) {
      var person = get_player(name)
      if (person && target && person.hp / person.max_hp < target.hp / target.max_hp) {
        target = person
      }
    }
    if (target && target.max_hp - target.hp < character.attack - 10 && target.hp / target.max_hp > .6) {
      target = null
    }
    if (can_heal(target)) {
      set_message("Healing " + target.name)
      heal(target)
    }
  }

  if (target && target.type === 'monster' || target && target.name === 'bleevl') {
    var dX = target.real_x - character.real_x
    var dY = target.real_y - character.real_y
    var dist = Math.hypot(dX, dY) - character.range
    var theta = Math.atan2(dY, dX)

    if (kite || !in_attack_range(target)) {
      move(character.real_x + dist * Math.cos(theta),
           character.real_y + dist * Math.sin(theta))
    }
  } else if (target && !in_attack_range(target)) {
    move(target.real_x, target.real_y)
  }
}

function potions() {
  if (new Date() < parent.next_potion) return;
  if (character.max_hp - character.hp > 200) {
		parent.use('hp')
	} else if (character.max_mp - character.mp > 100) {
    parent.use('mp')
  }
}

var lastcurse
function curse(target) {
  if ((!lastcurse || new Date() - lastcurse > 5000) && !target.cursed) {
    lastcurse = new Date();
    parent.socket.emit("ability", {
      name: "curse",
      id: target.id
    });
  }
}

function get_best_monster(max_hp, min_xp) {
  var target = null
  for (id in parent.entities) {
    var current = parent.entities[id]
    if (current.hp >= current.max_hp) continue;
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

setInterval(main, 1600/8)
