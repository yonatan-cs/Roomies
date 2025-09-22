rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ----- Helpers -----
    function isAuthenticated() { return request.auth != null; }
    function tokenApartmentId() {
      return isAuthenticated() && ('apartment_id' in request.auth.token)
        ? request.auth.token.apartment_id
        : null;
    }
    // Fallback: derive apartment id from the user's profile if claim is missing
    function currentApartmentId() {
      return tokenApartmentId() != null
        ? tokenApartmentId()
        : (isAuthenticated()
            && exists(/databases/$(database)/documents/users/$(request.auth.uid))
            && ('apartment' in get(/databases/$(database)/documents/users/$(request.auth.uid)).data)
            && ('id' in get(/databases/$(database)/documents/users/$(request.auth.uid)).data.apartment)
          ? get(/databases/$(database)/documents/users/$(request.auth.uid)).data.apartment.id
          : null);
    }
    function changedOnly(allowed) {
      return request.resource.data.diff(resource.data).changedKeys().hasOnly(allowed);
    }
    function emailUnchanged() {
      return (!('email' in resource.data)) ||
             !('email' in request.resource.data) ||
             request.resource.data.email == resource.data.email;
    }

    // ----- users -----
    match /users/{userId} {
      // Read own user doc
      allow read: if isAuthenticated() && request.auth.uid == userId;
      // Read other users in same apartment (uses fallback-aware currentApartmentId)
      allow read: if isAuthenticated()
        && request.auth.uid != userId
        && ('apartment' in resource.data)
        && ('id' in resource.data.apartment)
        && resource.data.apartment.id == currentApartmentId();

      allow create: if isAuthenticated()
        && request.auth.uid == userId
        && request.resource.data.email == request.auth.token.email
        && (
          !('apartment' in request.resource.data) ||
          !('id' in request.resource.data.apartment) ||
          request.resource.data.apartment.id == null
        );

      function canJoinNow() {
        return request.auth != null
          && request.auth.uid == userId
          && (
               !('apartment' in resource.data) ||
               !('id' in resource.data.apartment) ||
               resource.data.apartment.id == null ||
               resource.data.apartment.id == ''
             )
          && ('apartment' in request.resource.data)
          && ('id' in request.resource.data.apartment)
          && (request.resource.data.apartment.id is string)
          && exists(/databases/$(database)/documents/apartments/$(request.resource.data.apartment.id));
      }
      function canLeaveNow() {
        return ('apartment' in resource.data) && ('id' in resource.data.apartment)
          && resource.data.apartment.id is string
          && ('apartment' in request.resource.data) && ('id' in request.resource.data.apartment)
          && request.resource.data.apartment.id == null;
      }

      allow update: if isAuthenticated() && request.auth.uid == userId && (
        ( emailUnchanged() &&
          request.resource.data.diff(resource.data).changedKeys().hasOnly(['full_name','phone']) )
        || canJoinNow() || canLeaveNow()
      );
    }

    // ----- apartments -----
    match /apartments/{apartmentId} {
      allow read: if isAuthenticated() && apartmentId == currentApartmentId();
      allow create: if isAuthenticated()
        && request.resource.data.invite_code is string
        && request.resource.data.invite_code.size() == 6;
      allow update: if isAuthenticated()
        && apartmentId == tokenApartmentId()
        && changedOnly(['name','description']);
      allow delete: if false;
    }

    // ----- apartmentInvites -----
    match /apartmentInvites/{inviteCode} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated()
        && request.resource.data.invite_code == inviteCode
        && request.resource.data.invite_code is string
        && request.resource.data.invite_code.size() == 6
        && request.resource.data.apartment_id is string
        && request.resource.data.apartment_name is string;
      allow update, delete: if false;
    }

    // =========================================================
    //   NESTED collections under apartments/{apartmentId}/...
    //   (תוספת מינימלית כדי לתמוך במבנה החדש)
    // =========================================================

    // ----- expenses (nested) -----
    match /apartments/{apartmentId}/expenses/{expenseId} {
      allow read: if isAuthenticated() && apartmentId == currentApartmentId();

      allow create: if isAuthenticated()
        && apartmentId == currentApartmentId()
        && request.resource.data.paid_by_user_id == request.auth.uid
        && (!('visibleInUI' in request.resource.data) || request.resource.data.visibleInUI == true)
        && (!('apartment_id' in request.resource.data) || request.resource.data.apartment_id == apartmentId);

      allow update: if isAuthenticated()
        && apartmentId == currentApartmentId()
        && (!('apartment_id' in request.resource.data) || request.resource.data.apartment_id == apartmentId)
        && request.resource.data.paid_by_user_id == resource.data.paid_by_user_id;

      allow delete: if isAuthenticated()
        && apartmentId == currentApartmentId()
        && resource.data.paid_by_user_id == request.auth.uid
        && (!('apartment_id' in resource.data) || resource.data.apartment_id == apartmentId);
    }

    // ----- debtSettlements (nested) -----
    match /apartments/{apartmentId}/debtSettlements/{settlementId} {
      allow read: if isAuthenticated() && apartmentId == currentApartmentId();

      allow create: if isAuthenticated()
        && apartmentId == currentApartmentId()
        && (request.resource.data.payer_user_id == request.auth.uid
            || request.resource.data.receiver_user_id == request.auth.uid)
        && (!('apartment_id' in request.resource.data) || request.resource.data.apartment_id == apartmentId);

      allow update, delete: if false;
    }

    // ----- cleaningTasks (nested) -----
    match /apartments/{apartmentId}/cleaningTasks/{taskId} {
      allow read: if isAuthenticated() && apartmentId == currentApartmentId();

      // ב-nested אין צורך ב-taskId == apartment_id; מספיק דיוק לדירה
      allow create: if isAuthenticated()
        && apartmentId == currentApartmentId()
        && (!('apartment_id' in request.resource.data) || request.resource.data.apartment_id == apartmentId);

      allow update: if isAuthenticated()
        && apartmentId == currentApartmentId()
        && (!('apartment_id' in request.resource.data) || request.resource.data.apartment_id == apartmentId)
        && changedOnly(['user_id','rotation','assigned_at','frequency_days','apartment_id','last_completed_at','last_completed_by','current_index','checklist_seed_version'])
        && (!('last_completed_at' in request.resource.data) || request.resource.data.last_completed_at is timestamp)
        && (!('last_completed_by' in request.resource.data) || request.resource.data.last_completed_by == request.auth.uid);

      allow delete: if false;
    }

    // ----- cleaningTasks/checklistItems (nested) -----
    match /apartments/{apartmentId}/cleaningTasks/{taskId}/checklistItems/{itemId} {
      allow read: if isAuthenticated() && apartmentId == currentApartmentId();

      allow create: if isAuthenticated()
        && apartmentId == currentApartmentId()
        && (!('apartment_id' in request.resource.data) || request.resource.data.apartment_id == apartmentId);

      allow update: if isAuthenticated()
        && apartmentId == currentApartmentId()
        && (!('apartment_id' in request.resource.data) || request.resource.data.apartment_id == apartmentId)
        && get(/databases/$(database)/documents/apartments/$(apartmentId)/cleaningTasks/$(taskId)).data.user_id == request.auth.uid
        && changedOnly(['completed','completed_by','completed_at'])
        && (
             (request.resource.data.completed == true
               && request.resource.data.completed_by == request.auth.uid
               && request.resource.data.completed_at is timestamp)
             ||
             (request.resource.data.completed == false
               && (!('completed_by' in request.resource.data) || request.resource.data.completed_by == null)
               && (!('completed_at' in request.resource.data) || request.resource.data.completed_at == null))
           );

      allow delete: if false;
    }

    // ===== checklistItems collection GROUP (read only) נשאר =====
    match /{path=**}/checklistItems/{itemId} {
      allow read: if isAuthenticated()
        && resource.data.apartment_id == currentApartmentId();
      allow create, update, delete: if false;
    }

    // ===== Top-level collections (כמו שיש אצלך היום) =====
    match /expenses/{expenseId} {
      allow read: if isAuthenticated()
        && resource.data.apartment_id == currentApartmentId();
      allow create: if isAuthenticated()
        && request.resource.data.apartment_id == currentApartmentId()
        && (
             request.resource.data.paid_by_user_id == request.auth.uid
             || (('category' in request.resource.data) && request.resource.data.category == 'debt_settlement')
           )
        && (
             !('visibleInUI' in request.resource.data)
             || request.resource.data.visibleInUI == true
             || (request.resource.data.visibleInUI == false && ('category' in request.resource.data) && request.resource.data.category == 'debt_settlement')
           );
      allow update: if isAuthenticated()
        && resource.data.apartment_id == currentApartmentId()
        && request.resource.data.paid_by_user_id == resource.data.paid_by_user_id
        && request.resource.data.apartment_id == resource.data.apartment_id
        && (!('visibleInUI' in request.resource.data) || request.resource.data.visibleInUI == resource.data.visibleInUI);
      allow delete: if isAuthenticated()
        && resource.data.paid_by_user_id == request.auth.uid
        && resource.data.apartment_id == currentApartmentId();
    }

    match /debtSettlements/{settlementId} {
      allow read: if isAuthenticated()
        && resource.data.apartment_id == currentApartmentId();
      allow create: if isAuthenticated()
        && (request.resource.data.payer_user_id == request.auth.uid
            || request.resource.data.receiver_user_id == request.auth.uid)
        && request.resource.data.apartment_id == currentApartmentId();
      allow update, delete: if false;
    }

    // Debts (top-level)
    match /debts/{debtId} {
      allow read: if isAuthenticated()
        && resource.data.apartment_id == currentApartmentId();
      allow create: if isAuthenticated()
        && request.resource.data.apartment_id == currentApartmentId();
      allow update: if isAuthenticated()
        && resource.data.apartment_id == currentApartmentId()
        && request.resource.data.apartment_id == resource.data.apartment_id
        && request.resource.data.diff(resource.data).changedKeys().hasOnly(['status','closed_at','closed_by','cleared_amount','settlement_expense_id','updated_at']);
      allow delete: if false;
    }

    match /cleaningTasks/{taskId} {
      allow read: if isAuthenticated()
        && resource.data.apartment_id == currentApartmentId();

      allow create: if isAuthenticated()
        && request.resource.data.apartment_id == currentApartmentId()
        && taskId == request.resource.data.apartment_id;

      allow update: if isAuthenticated()
        && resource.data.apartment_id == currentApartmentId()
        && changedOnly(['user_id','rotation','assigned_at','frequency_days','apartment_id','last_completed_at','last_completed_by','current_index','checklist_seed_version'])
        && request.resource.data.apartment_id == resource.data.apartment_id
        && (!('last_completed_at' in request.resource.data) || request.resource.data.last_completed_at is timestamp)
        && (!('last_completed_by' in request.resource.data) || request.resource.data.last_completed_by == request.auth.uid);

      allow delete: if false;
    }

    match /cleaningTasks/{taskId}/checklistItems/{itemId} {
      allow read: if isAuthenticated()
        && resource.data.apartment_id == currentApartmentId();
      allow create: if isAuthenticated()
        && request.resource.data.apartment_id == currentApartmentId();
      allow update: if isAuthenticated()
        && resource.data.apartment_id == currentApartmentId()
        && changedOnly(['completed','completed_by','completed_at']);
      allow delete: if false;
    }

    match /shoppingItems/{itemId} {
      allow read: if isAuthenticated()
        && resource.data.apartment_id == currentApartmentId();

      allow create: if isAuthenticated()
        && request.resource.data.added_by_user_id == request.auth.uid
        && request.resource.data.apartment_id == currentApartmentId()
        && request.resource.data.name is string
        && (!('quantity' in request.resource.data) || request.resource.data.quantity is number)
        && (!('priority' in request.resource.data) ||
            request.resource.data.priority in ['low','normal','high'] || request.resource.data.priority is int)
        && (!('purchased' in request.resource.data) || request.resource.data.purchased == false)
        && (!('purchased_by_user_id' in request.resource.data) || request.resource.data.purchased_by_user_id == null);

      allow update: if isAuthenticated()
        && resource.data.apartment_id == currentApartmentId()
        && (
             (resource.data.purchased == false
               && changedOnly(['name','quantity','unit','notes','price','priority','name_lower','last_updated','order_index']))
             ||
             (changedOnly(['purchased','purchased_by_user_id','purchased_at','price'])
               && request.resource.data.purchased == true
               && request.resource.data.purchased_by_user_id == request.auth.uid
               && request.resource.data.purchased_at is timestamp)
             ||
             (changedOnly(['purchased','purchased_by_user_id','purchased_at'])
               && request.resource.data.purchased == false
               && resource.data.purchased_by_user_id == request.auth.uid
               && (!('purchased_by_user_id' in request.resource.data) || request.resource.data.purchased_by_user_id == null)
               && (!('purchased_at' in request.resource.data) || request.resource.data.purchased_at == null))
           );

      allow delete: if isAuthenticated()
        && resource.data.added_by_user_id == request.auth.uid
        && resource.data.purchased == false
        && resource.data.apartment_id == currentApartmentId();
    }

    // ----- balances -----
    match /balances/{apartmentId}/users/{userId} {
      allow read: if isAuthenticated()
        && apartmentId == currentApartmentId();
      // Allow members to create/update/delete balances within their apartment.
      // Enforce apartment/user consistency and restrict writable fields.
      allow create: if isAuthenticated()
        && apartmentId == currentApartmentId()
        && ('apartment_id' in request.resource.data ? request.resource.data.apartment_id == apartmentId : true)
        && ('user_id' in request.resource.data ? request.resource.data.user_id == userId : true);
      allow update: if isAuthenticated()
        && apartmentId == currentApartmentId()
        && (!('apartment_id' in request.resource.data) || request.resource.data.apartment_id == apartmentId)
        && (!('user_id' in request.resource.data) || request.resource.data.user_id == userId)
        && request.resource.data.diff(resource.data).changedKeys().hasOnly(['net','has_open_debts','updated_at','balance','apartment_id','user_id']);
      allow delete: if isAuthenticated()
        && apartmentId == currentApartmentId();
    }

    // ----- apartments stats -----
    match /apartments/{apartmentId}/stats/{statsId} {
      allow read: if isAuthenticated()
        && apartmentId == currentApartmentId();
      allow create: if isAuthenticated()
        && apartmentId == tokenApartmentId()
        && statsId == 'global';
      allow update: if isAuthenticated()
        && apartmentId == tokenApartmentId()
        && statsId == 'global'
        && request.resource.data.keys().hasOnly(['totalCleans','perUser','lastUpdated']);
      allow delete: if false;
    }

    // ----- audit logs -----
    match /apartments/{apartmentId}/audit_logs/{logId} {
      allow read: if isAuthenticated()
        && apartmentId == currentApartmentId();
      allow create: if request.auth.token.admin == true;
      allow update, delete: if false;
    }

    // ----- actions -----
    match /actions/{actionId} {
      allow read: if isAuthenticated()
        && resource.data.apartment_id == currentApartmentId();
      allow create: if isAuthenticated()
        && request.resource.data.apartment_id == currentApartmentId()
        && request.resource.data.type in [
             'debt_closed','debt_created','purchase','transfer',
             'member_removed','member_left','member_invited','member_joined'
           ]
        && request.resource.data.actor_uid == request.auth.uid
        && ('created_at' in request.resource.data);
      allow update, delete: if false;
    }

    // ----- default deny -----
    match /{document=**} { allow read, write: if false; }
  }
}
