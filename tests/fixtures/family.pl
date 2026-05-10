% Tiny Prolog source used by tests/test-prolog-file.js to exercise
% the `prologFile` Node loader. Encodes a 3-generation family with
% parent/2 facts and ancestor/2 (recursive) and grandparent/2.

parent(tom,    bob).
parent(tom,    liz).
parent(bob,    ann).
parent(bob,    pat).
parent(pat,    jim).

grandparent(X, Z) :- parent(X, Y), parent(Y, Z).

ancestor(X, Y) :- parent(X, Y).
ancestor(X, Y) :- parent(X, Z), ancestor(Z, Y).
