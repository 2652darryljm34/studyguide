#!/usr/bin/env python3
"""
Builds the Python classes-and-objects crash course into data/python-classes-guide.json (shown by review.html).

    python3 tools/build_oop_guide.py

Like the regex guide, every example is EXECUTED here and its real output is written under the code as '# ...' lines.
"""
import contextlib
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_regex_guide import H, SH, P, L, T, N, code  # noqa: E402  (block helpers shared with the regex guide)

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass

OUT = os.path.join(HERE, "..", "data", "python-classes-guide.json")


def run(src):
    """A code block: the code, then what it printed as '# ...' lines. Runs as __main__ so class reprs read naturally."""
    src = src.strip("\n")
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        exec(src, {"__name__": "__main__"})
    out = buf.getvalue().rstrip("\n")
    return {"type": "code", "text": src + ("\n" + "\n".join("# " + l for l in out.split("\n")) if out else "")}


SECTIONS = [
    ("1. What are classes and objects?", [
        P("A **class** is a blueprint: it describes what a kind of thing *has* (its data) and what it can *do* (its actions). An **object** is one real thing built from that blueprint. One class can make as many objects as you like, and each object keeps its own data."),
        P("Think of a cookie cutter and cookies: the cutter is the class, each cookie is an object. Or a house plan and the houses built from it."),
        P("You have used objects since your first Python program. Every value in Python is an object, and its type is its class:"),
        run('''
print(type("hello"))
print(type([1, 2, 3]))
print("hello".upper())
nums = [3, 1, 2]
nums.sort()
print(nums)
'''),
        P("`\"hello\".upper()` asks the string object to do something, and `nums.sort()` asks the list object to do something. Writing your own classes lets you make new kinds of objects with their own data and actions."),
        H("The four words to know"),
        T(["Term", "Meaning", "Example"],
          ["**Class**", "The blueprint that defines a kind of object", "`Dog`"],
          ["**Object** (or **instance**)", "One thing built from the class", "`rex = Dog(\"Rex\", 3)`"],
          ["**Attribute**", "A piece of data stored in an object (a variable that belongs to it)", "`rex.name`"],
          ["**Method**", "An action an object can do (a function that belongs to it)", "`rex.bark()`"]),
        N("Why bother?", "A class keeps related data and the functions that work on it together in one place. Instead of passing a name, an age and a balance into ten different functions, you pass one object that carries them."),
    ]),
    ("2. Syntax: defining a class and making objects", [
        P("A class is written with the keyword `class`, a name, a colon and an indented body. By convention class names use **CapitalizedWords**."),
        H("The smallest possible class"),
        run('''
class Dog:
    pass

rex = Dog()
fido = Dog()
print(isinstance(rex, Dog))
print(rex is fido)
print(rex.__class__.__name__)
'''),
        P("`Dog()` **creates an object** (this is called *instantiating* the class). `rex` and `fido` are two separate objects of the same class, so `rex is fido` is `False`. `pass` just means the body has nothing in it yet."),
        H("The full shape of a class"),
        code('''
class ClassName:
    """Optional docstring: what this class is for."""

    class_attribute = value              # shared by every object

    def __init__(self, param1, param2):  # runs when an object is created
        self.attr1 = param1              # instance attributes: one set per object
        self.attr2 = param2

    def method(self, arg):               # a method: first parameter is always self
        return self.attr1 + arg

obj = ClassName(1, 2)                    # create an object (no 'new' keyword)
obj.attr1                                # read an attribute
obj.attr1 = 10                           # change an attribute
obj.method(5)                            # call a method
'''),
        L("There is **no `new` keyword**: you call the class like a function.",
          "Everything inside the class is indented under the `class` line.",
          "Each method is a normal `def`, but its **first parameter is `self`**.",
          "Attributes are read and written with a dot: `obj.name`."),
    ]),
    ("3. __init__, self and attributes", [
        H("__init__: setting up a new object"),
        P("`__init__` is a special method that Python calls automatically whenever you create an object. It is where you give the new object its starting data. (Pronounced \"dunder init\": two underscores on each side.)"),
        run('''
class Dog:
    def __init__(self, name, age):
        self.name = name
        self.age = age

rex = Dog("Rex", 3)
fido = Dog("Fido", 7)
print(rex.name, rex.age)
print(fido.name, fido.age)
rex.age = 4
print(rex.age, fido.age)
'''),
        H("What self means"),
        P("`self` is the object the method is working on. When you write `Dog(\"Rex\", 3)`, Python makes a blank object, passes it to `__init__` as `self`, and `__init__` fills it in with `self.name = name`. You do **not** pass `self` yourself: Python does it."),
        L("`self.name = name` stores the parameter `name` in the object, under the attribute name `name`.",
          "The two `name`s are different things: `self.name` belongs to the object, the bare `name` is just the parameter.",
          "`rex` and `fido` each have their **own** `name` and `age`: changing `rex.age` does not touch `fido`."),
        H("Default values"),
        run('''
class Dog:
    def __init__(self, name, age=1):
        self.name = name
        self.age = age

print(Dog("Pup").age)
print(Dog("Rex", 3).age)
'''),
        H("Class attributes versus instance attributes"),
        P("An attribute assigned **inside the class body** (not inside a method) belongs to the class and is shared by every object. An attribute assigned on `self` belongs to one object."),
        run('''
class Dog:
    species = "Canis familiaris"      # class attribute: shared

    def __init__(self, name):
        self.name = name              # instance attribute: per object

rex = Dog("Rex")
fido = Dog("Fido")
print(rex.species, fido.species)
print(Dog.species)
Dog.species = "Dog"
print(rex.species, fido.species)
'''),
        N("Rule of thumb:", "data that differs between objects (a name, a balance) goes on `self`. A constant that is the same for all of them goes on the class."),
    ]),
    ("4. Methods", [
        P("A **method** is a function defined inside a class. It always takes `self` first, which is how it reaches the object's data. Methods can read attributes, change them, and return values."),
        run('''
class BankAccount:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance

    def deposit(self, amount):
        self.balance += amount

    def withdraw(self, amount):
        if amount > self.balance:
            return False          # not enough money
        self.balance -= amount
        return True

    def summary(self):
        return f"{self.owner}: ${self.balance}"

acct = BankAccount("Ann", 100)
acct.deposit(50)
print(acct.withdraw(500))
print(acct.withdraw(30))
print(acct.summary())
'''),
        H("Calling a method"),
        P("`acct.deposit(50)` is the normal way. Python turns it into `BankAccount.deposit(acct, 50)`, passing `acct` as `self`. That is why a method with the parameters `(self, amount)` is called with just one argument."),
        run('''
class Counter:
    def __init__(self):
        self.count = 0

    def add(self, n):
        self.count += n

c = Counter()
c.add(2)
Counter.add(c, 3)
print(c.count)
'''),
        H("Methods calling other methods"),
        run('''
class Rectangle:
    def __init__(self, width, height):
        self.width = width
        self.height = height

    def area(self):
        return self.width * self.height

    def describe(self):
        return f"{self.width} x {self.height}, area {self.area()}"

print(Rectangle(3, 4).describe())
'''),
        P("Inside a class, call another method of the same object with `self.method()`, not just `method()`."),
    ]),
    ("5. Special (dunder) methods", [
        P("Methods whose names start and end with two underscores are hooks Python calls for you. They let your objects work with built-in features like `print`, `==`, `<` and `len`."),
        T(["Method", "Called when you...", "Used for"],
          ["`__init__(self, ...)`", "create the object", "setting up attributes"],
          ["`__str__(self)`", "`print(obj)` or `str(obj)`", "a readable text version"],
          ["`__repr__(self)`", "look at it in the console, or `repr(obj)`", "an unambiguous version for programmers"],
          ["`__eq__(self, other)`", "`obj == other`", "defining what equal means"],
          ["`__lt__(self, other)`", "`obj < other`", "sorting and comparing"],
          ["`__len__(self)`", "`len(obj)`", "size of a collection-like object"]),
        H("Without __str__, print is unhelpful"),
        run('''
class Dog:
    def __init__(self, name):
        self.name = name

print(Dog("Rex"))
'''),
        P("The odd text is the default: the class name and where the object lives in memory (the address will differ on your machine). Define `__str__` to fix it."),
        run('''
class Dog:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __str__(self):
        return f"{self.name} ({self.age})"

    def __repr__(self):
        return f"Dog({self.name!r}, {self.age!r})"

    def __eq__(self, other):
        return self.name == other.name and self.age == other.age

    def __lt__(self, other):
        return self.age < other.age

a, b = Dog("Rex", 3), Dog("Rex", 3)
print(a)
print([a])
print(a == b, a is b)
print(sorted([Dog("Old", 9), Dog("Pup", 1)]))
'''),
        P("`print(a)` uses `__str__`. Printing a *list* of objects uses each object's `__repr__`. Without `__eq__`, `a == b` would be `False` because two separate objects are different unless you say otherwise. `sorted` needs `__lt__`."),
    ]),
    ("6. Inheritance", [
        P("**Inheritance** lets a new class start from an existing one. The new class (the **child**, or subclass) gets all the attributes and methods of the **parent** (or superclass), and can add or change things. Write the parent in parentheses after the child's name."),
        code('''
class Child(Parent):
    ...
'''),
        run('''
class Animal:
    def __init__(self, name):
        self.name = name

    def speak(self):
        return "..."

    def intro(self):
        return f"{self.name} says {self.speak()}"

class Dog(Animal):
    def speak(self):               # overrides the parent's version
        return "Woof"

class Cat(Animal):
    def speak(self):
        return "Meow"

for pet in [Dog("Rex"), Cat("Tom"), Animal("Thing")]:
    print(pet.intro())
'''),
        L("`Dog` and `Cat` did not write `__init__` or `intro`: they **inherited** them from `Animal`.",
          "`speak` is **overridden**: each child provides its own version, and Python uses the one belonging to the object's real class.",
          "Calling the same method on different kinds of object and getting different behaviour is called **polymorphism**."),
        H("super(): reuse the parent's __init__"),
        P("When the child needs extra attributes, call the parent's `__init__` with `super()` so you do not copy its code."),
        run('''
class Animal:
    def __init__(self, name):
        self.name = name

class Dog(Animal):
    def __init__(self, name, tricks):
        super().__init__(name)      # sets self.name
        self.tricks = tricks        # new attribute for Dog only

d = Dog("Rex", ["sit", "roll"])
print(d.name, d.tricks)
print(isinstance(d, Dog), isinstance(d, Animal))
print(issubclass(Dog, Animal))
'''),
        N("is-a:", "inheritance fits when the child **is a** kind of the parent (a Dog is an Animal). If it only *has* one (a Car has an Engine), store it as an attribute instead."),
    ]),
    ("7. Encapsulation and properties", [
        P("**Encapsulation** means keeping an object's data behind a controlled interface so it cannot easily be put into a bad state. Python does not enforce privacy; it uses naming conventions."),
        T(["Name", "Meaning"],
          ["`name`", "public: use freely"],
          ["`_name`", "one underscore: *internal*, please do not touch from outside the class (a convention only)"],
          ["`__name`", "two underscores: Python renames it to `_ClassName__name` to avoid accidental clashes in subclasses"]),
        H("@property: a method that looks like an attribute"),
        P("A **property** lets you run code (such as validation) when an attribute is read or written, while the outside code still just writes `obj.balance`."),
        run('''
class Account:
    def __init__(self, balance):
        self._balance = balance

    @property
    def balance(self):             # getter: obj.balance
        return self._balance

    @balance.setter
    def balance(self, value):      # setter: obj.balance = value
        if value < 0:
            raise ValueError("balance cannot be negative")
        self._balance = value

a = Account(100)
a.balance = 250
print(a.balance)
try:
    a.balance = -5
except ValueError as e:
    print("Error:", e)
'''),
        P("A property with no setter is read-only: assigning to it raises an `AttributeError`."),
    ]),
    ("8. Class methods, static methods and dataclasses", [
        T(["Kind", "Decorator", "First parameter", "Use it for"],
          ["Instance method", "(none)", "`self`: the object", "work on one object's data"],
          ["Class method", "`@classmethod`", "`cls`: the class", "alternative constructors, work on class-level data"],
          ["Static method", "`@staticmethod`", "(none)", "a utility function that belongs with the class but needs neither"]),
        run('''
class Dog:
    count = 0

    def __init__(self, name, age):
        self.name = name
        self.age = age
        Dog.count += 1

    @classmethod
    def from_string(cls, text):          # alternative constructor
        name, age = text.split(",")
        return cls(name, int(age))

    @staticmethod
    def is_valid_age(age):
        return 0 <= age <= 30

rex = Dog.from_string("Rex,3")
print(rex.name, rex.age)
print(Dog.is_valid_age(45))
print(Dog.count)
'''),
        H("dataclasses: less typing for data-holding classes"),
        P("If a class mostly stores data, `@dataclass` writes `__init__`, `__repr__` and `__eq__` for you from the attribute list."),
        run('''
from dataclasses import dataclass

@dataclass
class Point:
    x: int
    y: int = 0

p = Point(3)
print(p)
print(p == Point(3, 0))
'''),
    ]),
    ("9. Syntax at a glance and common mistakes", [
        T(["I want to...", "Write"],
          ["define a class", "`class Name:` (indented body)"],
          ["create an object", "`obj = Name(arg1, arg2)`"],
          ["set up attributes", "`def __init__(self, a, b): self.a = a`"],
          ["read / change an attribute", "`obj.a`  /  `obj.a = 5`"],
          ["define a method", "`def method(self, x): ...`"],
          ["call a method", "`obj.method(x)`"],
          ["class-wide variable", "assign in the class body, read as `Name.var` or `obj.var`"],
          ["readable printing", "define `__str__(self)`"],
          ["inherit", "`class Child(Parent):` and `super().__init__(...)`"],
          ["check type", "`isinstance(obj, Name)`"],
          ["list an object's attributes", "`vars(obj)`"]),
        H("Common mistakes"),
        L("**Forgetting `self`** in a method definition: `def deposit(amount)` fails with *takes 1 positional argument but 2 were given*, because Python passes the object as the first argument.",
          "**Forgetting `self.`** when using an attribute: `balance += amount` makes a local variable (and errors), `self.balance += amount` updates the object.",
          "**Forgetting the parentheses** when creating: `rex = Dog` makes `rex` another name for the class, not an object. Write `Dog(...)`.",
          "**Forgetting to return**: a method that calculates something but never `return`s gives `None`.",
          "**A shared mutable class attribute** (next example)."),
        run('''
class Bad:
    items = []                 # one list shared by ALL objects

    def add(self, x):
        self.items.append(x)

class Good:
    def __init__(self):
        self.items = []        # a new list for each object

    def add(self, x):
        self.items.append(x)

a, b = Bad(), Bad()
a.add(1)
print(b.items)

c, d = Good(), Good()
c.add(1)
print(d.items)
'''),
        P("`Bad.items` is created once, on the class, so `a` and `b` both see it. Make mutable data (lists, dicts) in `__init__` so each object gets its own."),
        H("See an object's data"),
        run('''
class Dog:
    def __init__(self, name, age):
        self.name = name
        self.age = age

rex = Dog("Rex", 3)
print(vars(rex))
print(hasattr(rex, "name"), hasattr(rex, "color"))
'''),
    ]),
]


def main():
    problems = [s for s, b in SECTIONS if not b]
    if problems:
        print("empty sections:", problems)
        return 1
    doc = {"title": "Python Classes and Objects: Crash Course",
           "description": "What classes and objects are, the Python syntax for them (class, __init__, self, attributes, methods), special methods, inheritance, properties, and the mistakes beginners make. Every example is run by Python.",
           "sections": [{"name": n, "blocks": b} for n, b in SECTIONS]}
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(doc, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    print("%d sections -> data/python-classes-guide.json" % len(SECTIONS))
    return 0


if __name__ == "__main__":
    sys.exit(main())
