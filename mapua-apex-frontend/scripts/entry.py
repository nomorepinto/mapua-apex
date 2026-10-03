import create_student_user

accounts = [
    {"name": "Jane Doe", "email": "jane@mapua.edu.ph", "organization name": "MGC"},
    {"name": "John Cruz", "email": "john@mapua.edu.ph", "organization name": "Organization X"},
]

create_student_user.create_student_account(accounts)
