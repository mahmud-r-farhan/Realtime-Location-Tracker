/**
 * Profile Management Module
 */

let userName = localStorage.getItem('userName') || '';
let orgName = localStorage.getItem('orgName') || 'public';

export function getUserName() {
    return userName;
}

export function getOrgName() {
    return orgName;
}

export function updateProfile(newName, newOrg) {
    if (newName !== undefined) {
        userName = newName;
        localStorage.setItem('userName', newName);
    }
    if (newOrg !== undefined) {
        orgName = newOrg;
        localStorage.setItem('orgName', newOrg);
    }
    
    // Dispatch event for other modules to react
    window.dispatchEvent(new CustomEvent('profileUpdate', { 
        detail: { userName, orgName } 
    }));
}

export function initProfile() {
    // Initial load from storage is already done above
    console.log('[Profile] Profile module initialized');
}
