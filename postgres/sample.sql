begin;

set local search_path to gieze;

insert into client values
('maison du sichon'),
('bio coop');

insert into product values
('grand duc'),
('crotte de fée');

insert into bl values
(1, 'maison du sichon', now() - interval '1 month', now()),
(2, 'maison du sichon', now(), null),
(3, 'bio coop', now(), null);

insert into bl_line values
(1, 'grand duc', 2),
(1, 'crotte de fée', 4),
(2, 'grand duc', 7),
(2, 'crotte de fée', 1),
(3, 'crotte de fée', 11);

commit;
