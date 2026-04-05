'use strict';
function wot_sort_carriers(data) {
    let n = data.length;
    for (let i = 0; i < n - 1; i++) {
        let check = false;
        for (let j = i + 1; j < n; j++) {
            if (data[i].name.toLowerCase() > data[j].name.toLowerCase()) {
                let tmp = data[i];
                data[i] = data[j];
                data[j] = tmp;
                check = true;
            }
        }
        if (!check) {
            break;
        }
    }
    return data;
}
function wot_get_carrier_by_slug(carrier_slug,carriers) {
    let found_carrier = {};
    for (let i = 0; i < carriers.length; i++) {
        if (carriers[i].slug === carrier_slug) {
            found_carrier = carriers[i];
            break;
        }
    }
    return found_carrier;
}