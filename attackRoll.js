on('chat:message', function(msg) {
    // Ignore messages not from players

    // Check if the message is using the 'atkdmg' template and has our custom marker
    if (msg.type === 'general' && msg.content.includes('{{template_type=custom_attack}}')) {
        // Extract the message content
        let content = msg.content;

        // Create an object to store the template fields
        let fields = {};

        // Use a regular expression to parse the template fields
        let regex = /\{\{(.*?)\}\}/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            let parts = match[1].split('=');
            fields[parts[0]] = parts[1] || '';
        }

        // Check for required fields
        if (!fields.attacker_id || !fields.target_id) {
            sendChat('Error', 'Attacker or target ID missing.');
            return;
        }

        // Get attacker and target tokens
        let attacker = getObj('graphic', fields.attacker_id);
        let target = getObj('graphic', fields.target_id);
        log('Target Token ID:', target);

        if (!attacker) {
            sendChat('Error', 'Invalid attacker token ID.');
            return;
        }

        if (!target) {
            sendChat('Error', 'Invalid target token ID.');
            return;
        }

        // Ensure inline rolls are present
        if (!msg.inlinerolls || msg.inlinerolls.length < 3) {
            sendChat('Error', 'No inline rolls found.');
            return;
        }

        // Extract inline rolls based on their order in the message
        let rollIndices = [];
        let rollRegex = /\$\[\[(\d+)\]\]/g;
        while ((match = rollRegex.exec(content)) !== null) {
            rollIndices.push(parseInt(match[1]));
        }

        if (rollIndices.length < 5) {
            sendChat('Error', 'Insufficient inline rolls found.');
            return;
        }

        // Map the rolls
        let r1RollIndex = rollIndices[1];
        let r2RollIndex = rollIndices[2];
        let dmg1RollIndex = rollIndices[3];
        let crit1RollIndex = rollIndices[4];
        let dmg2RollIndex = rollIndices.length > 5 ? rollIndices[5] : null;
        let crit2RollIndex = rollIndices.length > 6 ? rollIndices[6] : null;

        // Create a variable that grabs dmg1's formula
        let dmg1Formula = msg.inlinerolls[dmg1RollIndex].expression;
        let dmg2Formula = dmg2RollIndex !== null ? msg.inlinerolls[dmg2RollIndex].expression : 0;
        let crit1Formula = msg.inlinerolls[crit1RollIndex].expression;
        let crit2Formula = crit2RollIndex !== null ? msg.inlinerolls[crit2RollIndex].expression : 0;

        let attackRollResult = msg.inlinerolls[r1RollIndex].results.total;
        let attackRollResult2 = msg.inlinerolls[r2RollIndex].results.total;
        let damageRollResult = msg.inlinerolls[dmg1RollIndex].results.total;
        let critDamageRollResult = msg.inlinerolls[crit1RollIndex].results.total;
        let roll = libInline.getRollTip(msg.inlinerolls[crit1RollIndex]);
        
        let critDamageRollDisplay = roll.replace(/(style="[^"]+)"/, '$1 background-color:black; color:white; border: 2px solid black;"');
        let roll2 = crit2RollIndex !== null ? libInline.getRollTip(msg.inlinerolls[crit2RollIndex]) : 0;
        let critDamageRoll2Display = crit2RollIndex !== null ? roll2.replace(/(style="[^"]+)"/, '$1 background-color:black; color:white; border: 2px solid black;"') : 0;
        let damage2RollResult = dmg2RollIndex !== null ? msg.inlinerolls[dmg2RollIndex].results.total : 0;
        let crit2RollResult = crit2RollIndex !== null ? msg.inlinerolls[crit2RollIndex].results.total : 0;
        let damageType = fields.dmg1type;
        let damageType2 = fields.dmg2type;
        let attackName = fields.rname + " Crit Damage";
        let savageAttackName = fields.rname + " Savage Attack";
        
        let isTwoDamages = msg.content.includes('{{dmg2flag=1}}');
        let isCritical = msg.inlinerolls[r1RollIndex].results.rolls[0].results[0].v === 20;
        let isCritical2 = false;
        let isCritical3 = false;
        
        // Determine hit or miss
        let targetAC = parseInt(target.get('bar2_value') || 10, 10);
        let hit = null;
        if(msg.content.includes('always')){
            isCritical2 = msg.inlinerolls[r2RollIndex].results.rolls[0].results[0].v === 20;
            hit = attackRollResult >= targetAC || attackRollResult2 >= targetAC;
        }
        else if(msg.content.includes('disadvantage')){
            isCritical2 = msg.inlinerolls[r2RollIndex].results.rolls[0].results[0].v === 20;
            hit = attackRollResult >= targetAC && attackRollResult2 >= targetAC;
        }
        else
        {
            hit = attackRollResult >= targetAC;
        }
        
        if(msg.content.includes('{{autoCrit}}')){
            isCritical3 = true;
        }
        

        if (hit) {
            const targetCharId = target.get('represents');
            if (targetCharId) {
                const resistAttr = findObjs({
                type: 'attribute',
                characterid: targetCharId,
                name: 'resistances'
            })[0];
        
            if (resistAttr) {
                let resistString = resistAttr.get('current') || '';
                let resistList = resistString.split(/[,;]/).map(s => s.trim().toLowerCase());
                let dmgTypeLower = (damageType || '').toLowerCase();
                let dmg2TypeLower = (damageType2 || '').toLowerCase();
            
                if (resistList.includes(dmgTypeLower)) {
                damageRollResult = Math.floor(damageRollResult / 2);
                critDamageRollResult = Math.floor(critDamageRollResult/2);
                }
                
                if (resistList.includes(dmg2TypeLower)) {
                damage2RollResult = Math.floor(damage2RollResult / 2);
                crit2RollResult = Math.floor(crit2RollResult / 2);
                }
            }
            }
            
            if (targetCharId) {
            const immunity = findObjs({
                type: 'attribute',
                characterid: targetCharId,
                name: 'immunities'
            })[0];
            
                if(immunity){
                    let immuneString = immunity.get('current') || '';
                    let immuneList = immuneString.split(/[,;]/).map(s => s.trim().toLowerCase());
                    let savageDamageType2 = (damageType || '').toLowerCase();
                    let savageDamageType3 = (damageType2 || '').toLowerCase();
                
                    if(immuneList.includes(savageDamageType2)){
                        damageRollResult = 0;
                        critDamageRollResult = 0;
                    }
                    
                    if(immuneList.includes(savageDamageType3)){
                        damage2RollResult = 0;
                        crit2RollResult = 0;
                    }
                }
            }
            
            totalDamage = damageRollResult + damage2RollResult;

            if (isCritical || isCritical2 || isCritical3) {
                totalDamage += critDamageRollResult;
                if(isTwoDamages){
                    totalDamage += crit2RollResult;
                }
            }
    
            if (msg.content.includes('{{savageAttacker}}')) {/*{{crit=1}} {{crit1=[[${crit1Formula}]]}} {{savageAttackId=${uniqueId}}}*/
            
            if(isTwoDamages){  // Send a message to roll savage attack damage, include unique identifier
                if(isCritical || isCritical2){
                    sendChat('', `&{template:dmg} {{rname=${savageAttackName}}} {{target_id=${target.id}}} {{template_type=savage}} {{damage=1}} {{dmg1flag=1}} {{dmg1type=${damageType}}} {{dmg1=[[${dmg1Formula}]]}} {{crit=1}} {{crit1=[[${crit1Formula}]]}} {{dmg2flag=1}} {{dmg2=[[${dmg2Formula}]]}} {{dmg2type=${damageType2}}} {{crit2=[[${crit2Formula}]]}} {{savageAttackin=${totalDamage}}}`);
                }
                else if(isCritical3){
                    sendChat('', `&{template:dmg} {{rname=${attackName}}} {{damage=1}} {{dmg1flag=1}} {{dmg1type=${damageType}}} {{dmg1=${critDamageRollDisplay}}} {{dmg2flag=1}} {{dmg2type=${damageType2}}} {{dmg2=${critDamageRoll2Display}}}`);
                    sendChat('', `&{template:dmg} {{rname=${savageAttackName}}} {{target_id=${target.id}}} {{template_type=savage}} {{damage=1}} {{dmg1flag=1}} {{dmg1type=${damageType}}} {{dmg1=[[${dmg1Formula}]]}} {{crit=1}} {{crit1=[[${crit1Formula}]]}} {{dmg2flag=1}} {{dmg2=[[${dmg2Formula}]]}} {{dmg2type=${damageType2}}} {{crit2=[[${crit2Formula}]]}} {{savageAttackin=${totalDamage}}}`);
                }
                else{
                   sendChat('', `&{template:dmg} {{target_id=${target.id}}} {{template_type=savage}} {{rname=Savage Attack}} {{damage=1}} {{dmg1flag=1}} {{dmg1type=${damageType}}} {{dmg1=[[${dmg1Formula}]]}} {{dmg2flag=1}} {{dmg2=[[${dmg2Formula}]]}} {{dmg2type=${damageType2}}} {{crit2=[[${crit2Formula}]]}} {{savageAttackin=${totalDamage}}}`);
                }
            }
            else{
                if(isCritical || isCritical2){
                sendChat('', `&{template:dmg} {{rname=${savageAttackName}}} {{target_id=${target.id}}} {{template_type=savage}} {{damage=1}} {{dmg1flag=1}} {{dmg1type=${damageType}}} {{dmg1=[[${dmg1Formula}]]}} {{crit=1}} {{crit1=[[${crit1Formula}]]}} {{savageAttackin=${totalDamage}}}`);
                }
                else if(isCritical3){
                    sendChat('', `&{template:dmg} {{rname=${attackName}}} {{damage=1}} {{dmg1flag=1}} {{dmg1type=${damageType}}} {{dmg1=${critDamageRollDisplay}}}`);
                    sendChat('', `&{template:dmg} {{rname=${savageAttackName}}} {{target_id=${target.id}}} {{template_type=savage}} {{damage=1}} {{dmg1flag=1}} {{dmg1type=${damageType}}} {{dmg1=[[${dmg1Formula}]]}} {{crit=1}} {{crit1=[[${crit1Formula}]]}} {{savageAttackin=${totalDamage}}}`);
                }
                else{
                   sendChat('', `&{template:dmg} {{target_id=${target.id}}} {{template_type=savage}} {{rname=Savage Attack}} {{damage=1}} {{dmg1flag=1}} {{dmg1type=${damageType}}} {{dmg1=[[${dmg1Formula}]]}} {{savageAttackin=${totalDamage}}} `);
                }
            }
            } else {
                if(isCritical3){
                    if(isTwoDamages){
                    sendChat('', `&{template:dmg} {{rname=${attackName}}} {{damage=1}} {{dmg1flag=1}} {{dmg1type=${damageType}}} {{dmg1=${critDamageRollDisplay}}} {{dmg2flag=1}} {{dmg2type=${damageType2}}} {{dmg2=${critDamageRoll2Display}}}`);
                    }
                    else{
                    sendChat('', `&{template:dmg} {{rname=${attackName}}} {{damage=1}} {{dmg1flag=1}} {{dmg1type=${damageType}}} {{dmg1=${critDamageRollDisplay}}}`); 
                    }
                }
                
                let targetHP = parseInt(target.get('bar1_value') || 0, 10);
                target.set('bar1_value', targetHP - totalDamage);
            }
        }
    }
});


// Listen for Savage Attack roll result
// Listen for Savage Attack roll result
on('chat:message', function(msg2) {
    if (msg2.type === 'general' && msg2.content.includes('{{template_type=savage}}')) {
        
        let content2 = msg2.content;
        let fields2 = {};
        let regex2 = /\{\{(.*?)\}\}/g;
        let match2;
        while ((match2 = regex2.exec(content2)) !== null) {
            let parts2 = match2[1].split('=');
            fields2[parts2[0]] = parts2[1] || '';
        }

        if (!msg2.inlinerolls || msg2.inlinerolls.length < 1) {
            sendChat('Error', 'No inline rolls found for savage attack.');
            return;
        }

        // Primary damage is inline roll 0
        let savageAttackDamageRollResult = msg2.inlinerolls[0].results.total || 0;
        // Secondary damage might be inline roll 2 (if your template sets it there)
        let savageAttackDamageRollResult2 = 0;
        if (msg2.inlinerolls[2]) {
            savageAttackDamageRollResult2 = msg2.inlinerolls[2].results.total || 0;
        }
        let critPrimary   = (msg2.inlinerolls[1]) ? msg2.inlinerolls[1].results.total : 0;
        let critSecondary = (msg2.inlinerolls[3]) ? msg2.inlinerolls[3].results.total : 0;

        // We'll parse the two damage types from the template
        let primaryDamageType   = (fields2.dmg1type || '').toLowerCase();
        let secondaryDamageType = (fields2.dmg2type || '').toLowerCase();
        

        // Compare damage
        let compareDamage = parseInt(fields2.savageAttackin) || 0;

        // Get the target token
        let target = getObj('graphic', fields2.target_id);
        if (!target) {
            sendChat('Error', 'Invalid target token ID.');
            return;
        }

        let targetHP    = parseInt(target.get('bar1_value') || 0, 10);
        let targetCharId = target.get('represents');

        // If the character has resistances/immunities, apply them
        if (targetCharId) {
            let resistAttr = findObjs({
                type: 'attribute',
                characterid: targetCharId,
                name: 'resistances'
            })[0];

            if (resistAttr) {
                let resistList = resistAttr.get('current')
                    .split(/[,;]/)
                    .map(s => s.trim().toLowerCase());

                if (resistList.includes(primaryDamageType)) {
                    savageAttackDamageRollResult = Math.floor(savageAttackDamageRollResult / 2);
                    critPrimary = Math.floor(critPrimary / 2);
                }
                if (resistList.includes(secondaryDamageType)) {
                    savageAttackDamageRollResult2 = Math.floor(savageAttackDamageRollResult2 / 2);
                    critSecondary = Math.floor(critSecondary / 2);
                }
            }

            let immunityAttr = findObjs({
                type: 'attribute',
                characterid: targetCharId,
                name: 'immunities'
            })[0];
            
            if (immunityAttr) {
                let immuneList = immunityAttr.get('current')
                    .split(/[,;]/)
                    .map(s => s.trim().toLowerCase());

                if (immuneList.includes(primaryDamageType)) {
                    savageAttackDamageRollResult = 0;
                    critPrimary = 0;
                }
                if (immuneList.includes(secondaryDamageType)) {
                    savageAttackDamageRollResult2 = 0;
                    critSecondary = 0;
                }
            }
        }

        // Sum them up
        let totalDamage = savageAttackDamageRollResult + savageAttackDamageRollResult2;
        
        // If your template indicates a crit...
        if (msg2.content.includes('{{crit=1}}')) {
            // Possibly we have more inline rolls for the crit portion (like at index 1, index 3, etc.)
            totalDamage += critPrimary + critSecondary;
        }
        
        // Compare with savageAttackin
        if (compareDamage > totalDamage) {
          totalDamage = compareDamage; 
        }

        // Apply final HP
        target.set('bar1_value', targetHP - totalDamage);
    }
});

on('chat:message', function (msg) {
    if (msg.type === 'api' && msg.content.startsWith('!customAttack')) {
        const args = msg.content.slice(13).trim().split('|');

        // Validate the minimum required input
        if (args.length < 7) {
            sendChat(
                'Error',
                'Usage: !customAttack <attacker_id>|<target_id>|<attack_name>|<damage_type>|<attack_roll_formula>|<damage_roll_formula>|<critical_roll_formula>|[optional_fields]'
            );
            return;
        }

        const [
            attackerId,
            targetId,
            attackName,
            damageType,
            attackRollFormula,
            damageRollFormula,
            critRollFormula,
            ...optionalFields
        ] = args.map((arg) => arg.trim());

        // Validate attacker and target tokens
        const attacker = getObj('graphic', attackerId);
        const target = getObj('graphic', targetId);

        if (!attacker) {
            sendChat('Error', 'Invalid attacker token ID.');
            sendChat('Error', 'Its Me.');
            return;
        }

        if (!target) {
            sendChat('Error', 'Invalid target token ID.');
            return;
        }

        // Check for optional fields and modify template accordingly
        let rollType = `{{normal=1}} `
        let advantageField = false;
        let additionalFields = '';
        attackMod = attackRollFormula.replace(/1d20\s*\+\s*/i, ""); // Now rollFormula = "5"
        attackMod = attackMod ? parseInt(attackMod) : null;

        optionalFields.forEach((field) => {
            if (field === 'advantage') {
                // Replace {{normal=1}} with {{always=1}} in the template below
                advantageField = true;
                rollType = `{{always=1}}`;
            } else if(field === 'disadvantage'){
                rollType = `{{disadvantage=1}}`;
            } else if (field === 'autoCrit'){
                additionalFields += `{{autoCrit}} `;
            } else if (field === 'savageAttacker') {
                additionalFields += `{{savageAttacker}} `;
            }
        });

        // Construct the attack template
        let attackTemplate = `&{template:atkdmg} ` +
            `{{template_type=custom_attack}} ` +
            `{{attacker_id=${attackerId}}} ` +
            `{{target_id=${targetId}}} ` +
            `{{rname=${attackName}}} ` +
            `{{mod=+[[${attackMod}]]}} ` +
            `{{r1=[[${attackRollFormula}]]}} ` + // Advantage check
            `{{r2=[[${attackRollFormula}]]}} ` +
            rollType +
            `{{attack=1}} ` +
            `{{damage=1}} ` +
            `{{dmg1flag=1}} ` +
            `{{dmg1=[[${damageRollFormula}]]}} ` +
            `{{dmg1type=${damageType}}} ` +
            `{{crit1=[[${critRollFormula}]]}} ` +
            `${additionalFields}`; // Add additional fields (e.g., autoCrit, savageAttacker)

        // Send the custom attack as the player
        sendChat(msg.who, attackTemplate);
    }
});

on('chat:message', function (msg) {
    // Listen for the "!customAttack2" command
    if (msg.type === 'api' && msg.content.startsWith('!custom2Attack')) {
        // Split arguments on '|'
        const args = msg.content.slice('!custom2Attack'.length).trim().split('|');

        // We require at least 10 fields for two-damage attacks, plus any optional
        // e.g. attackerID, targetID, name, dmgType1, roll formula, dmg1, crit1, dmgType2, dmg2, crit2
        if (args.length < 10) {
            sendChat('Error', 
                'Usage: !custom2Attack ' +
                '<attacker_id>|<target_id>|<attack_name>|<damage_type1>|<attack_roll_formula>|' +
                '<damage_roll1>|<crit_roll1>|<damage_type2>|<damage_roll2>|<crit_roll2>|[optional_fields...]'
            );
            return;
        }

        // Extract the core fields
        const [
            attackerId,
            targetId,
            attackName,
            damageType1,
            attackRollFormula,
            damageRoll1,
            critRoll1,
            damageType2,
            damageRoll2,
            critRoll2,
            ...optionalFields // whatever remains
        ] = args.map(arg => arg.trim());

        // Validate attacker & target
        const attacker = getObj('graphic', attackerId);
        const target   = getObj('graphic', targetId);
        if (!attacker) {
            sendChat('Error', 'Invalid attacker token ID.');
            c
            return;
        }
        if (!target) {
            sendChat('Error', 'Invalid target token ID.');
            return;
        }

        // Check for optional flags
        let advantageField   = false;
        let rollType = `{{normal=1}}`;
        let additionalFields = '';

        // Attempt to parse the numeric "attack bonus" from e.g. "1d20+5"
        let attackMod = attackRollFormula.replace(/1d20\s*\+\s*/i, "");
        attackMod     = attackMod ? parseInt(attackMod) : null;

        optionalFields.forEach((field) => {
            if (field === 'advantage') {
                // Replace {{normal=1}} with {{always=1}} in the template below
                advantageField = true;
                rollType = `{{always=1}}`;
            } else if(field === 'disadvantage'){
                rollType = `{{disadvantage=1}}`;
            } else if (field === 'autoCrit') {
                additionalFields += `{{autoCrit}} `;
            } else if (field === 'savageAttacker') {
                additionalFields += `{{savageAttacker}} `;
            }
            // Add more flags as needed
        });

        // Build the final chat template
        // Notice we have two damage lines: dmg1 / crit1, and dmg2 / crit2
        let attackTemplate = 
            `&{template:atkdmg} ` +
            `{{template_type=custom_attack}} ` +   // marker for your script
            `{{attacker_id=${attackerId}}} ` +
            `{{target_id=${targetId}}} ` +
            `{{rname=${attackName}}} ` +
            `{{mod=+[[${attackMod}]]}} ` +
            `{{r1=[[${attackRollFormula}]]}} ` +// advantage or normal
            `{{r2=[[${attackRollFormula}]]}} ` +
            rollType + 
            ` {{attack=1}} ` +
            `{{damage=1}} ` +
            // --- Primary damage line ---
            `{{dmg1flag=1}} ` +
            `{{dmg1=[[${damageRoll1}]]}} ` +
            `{{dmg1type=${damageType1}}} ` +
            `{{crit1=[[${critRoll1}]]}} ` +
            // --- Secondary damage line ---
            `{{dmg2flag=1}} ` +
            `{{dmg2=[[${damageRoll2}]]}} ` +
            `{{dmg2type=${damageType2}}} ` +
            `{{crit2=[[${critRoll2}]]}} ` +
            // --- Optional fields (autoCrit, savageAttacker, etc.) ---
            additionalFields;
        // Finally, send the chat message
        sendChat(msg.who, attackTemplate);
    }
});
