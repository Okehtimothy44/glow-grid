;; GlowGrid User Profile Management Contract
;; Manages user profiles with secure, blockchain-based profile tracking
;; Features:
;; - Unique username registration
;; - Secure profile creation and updates
;; - Achievement tracking with limits
;; - Principal-based access control

(define-constant ERR_UNAUTHORIZED u401)
(define-constant ERR_PROFILE_EXISTS u402)
(define-constant ERR_PROFILE_NOT_FOUND u404)
(define-constant ERR_INVALID_USERNAME u405)
(define-constant ERR_MAX_ACHIEVEMENTS u406)

;; Constants
(define-constant MAX_USERNAME_LENGTH u50)
(define-constant MAX_EMAIL_LENGTH u100)
(define-constant MAX_ACHIEVEMENTS u10)

;; Data Structures
;; User Profiles Map
;; Stores comprehensive user information with achievement tracking
(define-map user-profiles 
  principal 
  {
    username: (string-ascii MAX_USERNAME_LENGTH),  ;; Unique username
    email-hash: (buff 32),                         ;; Hashed email for privacy
    skill-level: uint,                             ;; User's skill progression
    achievements: (list MAX_ACHIEVEMENTS (string-ascii 50))  ;; Achievement identifiers
  }
)

;; Username uniqueness tracking
(define-map usernames-taken 
  (string-ascii MAX_USERNAME_LENGTH) 
  bool
)

;; Private Helper Functions
(define-private (validate-username (username (string-ascii MAX_USERNAME_LENGTH)))
  (and 
    (> (len username) u0)
    (<= (len username) MAX_USERNAME_LENGTH)
    (is-none (map-get? usernames-taken username))
  )
)

;; Read-Only Functions
(define-read-only (get-user-profile (user principal))
  (map-get? user-profiles user)
)

(define-read-only (is-username-taken (username (string-ascii MAX_USERNAME_LENGTH)))
  (is-some (map-get? usernames-taken username))
)

;; Public Functions
(define-public (create-profile 
  (username (string-ascii MAX_USERNAME_LENGTH))
  (email-hash (buff 32))
  (initial-skill-level uint)
)
  (begin
    ;; Validate that the username meets requirements
    (asserts! (validate-username username) (err ERR_INVALID_USERNAME))
    
    ;; Ensure the user doesn't already have a profile
    (asserts! (is-none (map-get? user-profiles tx-sender)) (err ERR_PROFILE_EXISTS))
    
    ;; Create the profile
    (map-set user-profiles tx-sender {
      username: username,
      email-hash: email-hash,
      skill-level: initial-skill-level,
      achievements: (list)
    })
    
    ;; Mark username as taken
    (map-set usernames-taken username true)
    
    (ok true)
  )
)

(define-public (update-profile 
  (new-email-hash (optional (buff 32))) 
  (new-skill-level (optional uint))
)
  (let (
    (current-profile (unwrap! (map-get? user-profiles tx-sender) (err ERR_PROFILE_NOT_FOUND)))
    (updated-profile 
      (merge current-profile 
        (if (is-some new-email-hash)
          { email-hash: (unwrap-panic new-email-hash) }
          {}))
    (final-profile
      (merge updated-profile
        (if (is-some new-skill-level)
          { skill-level: (unwrap-panic new-skill-level) }
          {}))
  )
    (map-set user-profiles tx-sender final-profile)
    (ok true)
  )
)

(define-public (add-achievement (achievement (string-ascii 50)))
  (let (
    (current-profile (unwrap! (map-get? user-profiles tx-sender) (err ERR_PROFILE_NOT_FOUND)))
    (current-achievements (get achievements current-profile))
  )
    (asserts! (< (len current-achievements) MAX_ACHIEVEMENTS) (err ERR_MAX_ACHIEVEMENTS))
    
    (map-set user-profiles tx-sender 
      (merge current-profile 
        { achievements: (unwrap-panic (as-max-len (append current-achievements achievement) MAX_ACHIEVEMENTS)) }
      )
    )
    
    (ok true)
  )
)

(define-public (remove-achievement (achievement (string-ascii 50)))
  (let (
    (current-profile (unwrap! (map-get? user-profiles tx-sender) (err ERR_PROFILE_NOT_FOUND)))
    (current-achievements (get achievements current-profile))
    (filtered-achievements 
      (filter 
        (lambda (x) (not (is-eq x achievement))) 
        current-achievements
      )
    )
  )
    (map-set user-profiles tx-sender 
      (merge current-profile 
        { achievements: filtered-achievements }
      )
    )
    
    (ok true)
  )
)