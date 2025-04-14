print("the usernames: ")

for i in range(150):
    if i % 3 == 0:
        print("admin")
    else:
        print("user1")

print(" the passwords:")

with open("candidate-passwords.txt", "r") as f:
    lines = f.readlines()

i = 0
for pwd in lines:
    if i % 3 == 0:
        print("admin")
    else:
        print(pwd.strip('\n'))
    i = i + 1
