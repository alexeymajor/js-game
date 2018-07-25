'use strict';

class Vector {
    constructor (x=0, y=0) {
        this.x = x;
        this.y = y;
    }

    plus(vector) {
        if (!(vector instanceof Vector)) {
            throw new Error('Можно прибавлять к вектору только вектор типа Vector');
        }
        return new Vector(this.x + vector.x, this.y + vector.y);
    }

    times(multiplier) {
        return new Vector(this.x * multiplier, this.y * multiplier);
    }

}

class Actor {

    constructor(pos = new Vector(0, 0), size = new Vector(1, 1), speed = new Vector(0,0)) {
        if (!((pos instanceof Vector) && (size instanceof Vector) && (speed instanceof Vector))) {
            throw new Error('Аргументы конструктора должны быть только типа Vector');
        }

        this.pos = pos;
        this.size = size;
        this.speed = speed;
    }

    act() {

    }

    get left() {
        return this.pos.x;
    }

    get right() {
        return this.pos.x + this.size.x;
    }

    get top() {
        return this.pos.y;
    }

    get bottom() {
        return this.pos.y + this.size.y;
    }

    get type() {
        return 'actor';
    }

    isIntersect(actor) {
        if (!(actor instanceof Actor)) {
            throw new Error('Аргумент конструктора должен быть типа Actor');
        }

        if (this === actor) {
            return false;
        }

        return (this.left < actor.right)
            && (this.right > actor.left)
            && (this.top < actor.bottom)
            && (this.bottom > actor.top);
    }

}

class Level {
    constructor(grid=[], actors=[]) {
        this.grid = grid;
        this.actors = actors;
        this.player = actors.find(value => {
            if (value instanceof Player) {
                return value
            }
        });

        this.status = null;

        this.finishDelay = 1;

        this.height = grid.length;

        this.width = grid.reduce((width, row) => {
            if (row.length > width) {
                width = row.length;
            }
            return width;
        }, 0);
    }

    isFinished() {
        return (this.status !== null) && (this.finishDelay < 0);
    }

    actorAt(actor) {
        return this.actors.find(value => actor.isIntersect(value));
    }

    obstacleAt(pos, size) {
        const actor = new Actor(pos, size);
        if (actor.bottom > this.height) {
            return 'lava';
        }
        if ((actor.left < 0) || (actor.right > this.width) || (actor.top < 0)) {
            return 'wall';
        }
        for (let col = Math.floor(actor.top); col < Math.ceil(actor.bottom); col++) {
            for(let row = Math.floor(actor.left); row < Math.ceil(actor.right); row++) {
                const intersection = this.grid[col][row];
                if (intersection !== undefined) {
                    return intersection;
                }
            }
        }
    }

    removeActor(actor) {
        const i = this.actors.indexOf(actor);
        if (i >= 0) this.actors.splice(i, 1);
    }

    noMoreActors(type) {
        return this.actors.find(value => value.type === type) === undefined;
    }

    playerTouched(type, actor) {
        if (this.status !== null) {
            return;
        }
        if (['lava', 'fireball'].includes(type)) {
            this.status = 'lost';
            return;
        }
        if (type === 'coin') {
            this.removeActor(actor);
            if (this.noMoreActors(type)) {
                this.status = 'won';
                return;
            }
        }
    }
}

class LevelParser {
    constructor(actorsMap) {
        this.actorsMap = actorsMap;
        this.obstacles = {
            'x': 'wall',
            '!': 'lava'
        }
    }

    actorFromSymbol(symbol) {
        return this.actorsMap !== undefined && symbol in this.actorsMap ? this.actorsMap[symbol] : undefined;
    }

    obstacleFromSymbol(symbol) {
        return this.obstacles[symbol];
    }

    createGrid(gridStr) {
        const grid = [];
        for (const line of gridStr) {
            grid.push(
                line.split('').map(value => {
                    return this.obstacleFromSymbol(value)
                })
            );
        }
        return grid;
    }

    createActors(str) {
        return str.reduce((actors, line, col) => {
            actors = line.split('').reduce((memo, symbol, row) => {
                const ActorRef = this.actorFromSymbol(symbol);
                if (ActorRef === undefined || (typeof ActorRef) !== 'function') {
                    return memo;
                }
                const actor = new ActorRef(new Vector(row, col));
                if (actor instanceof Actor) {
                    memo.push(actor);
                }
                return memo;
            }, actors);
            return actors;
        }, []);
    }

    parse(gridStr) {
        return new Level(this.createGrid(gridStr), this.createActors(gridStr));
    }
}

class Fireball extends Actor {
    constructor(pos, speed) {
        super(pos, new Vector(1,1), speed);
    }

    get type() {
        return 'fireball';
    }

    getNextPosition(time=1) {
        return this.pos.plus(
            this.speed.times(time)
        );
    }

    handleObstacle() {
        this.speed = this.speed.times(-1);
    }

    act(time, level) {
        const pos = this.getNextPosition(time);
        if (level.obstacleAt(pos, this.size) === undefined) {
            this.pos = pos;
            return;
        }
        this.handleObstacle();
    }
}

class HorizontalFireball extends Fireball {
    constructor(pos) {
        super(pos, new Vector(2, 0));
    }
}

class VerticalFireball extends Fireball {
    constructor(pos) {
        super(pos, new Vector(0, 2));
    }
}

class FireRain extends Fireball {
    constructor(pos) {
        super(pos, new Vector(0, 3));
        this.defaultPos = this.pos.times(1);
    }

    handleObstacle() {
        this.pos = this.defaultPos.times(1);
    }
}

class Coin extends Actor {
    constructor(pos) {
        super(pos, new Vector(0.6, 0.6));
        this.pos.x += 0.2;
        this.pos.y += 0.1;
        this.defaultPos = this.pos.times(1);
        this.spring = Math.random() * Math.PI * 2;
    }

    get type() {
        return 'coin';
    }

    get springSpeed() {
        return 8;
    }

    get springDist() {
        return 0.07;
    }

    updateSpring(time=1) {
        this.spring += this.springSpeed * time;
    }

    getSpringVector() {
        return new Vector(0, Math.sin(this.spring) * this.springDist);
    }

    getNextPosition(time=1) {
        this.updateSpring(time);
        return this.defaultPos.plus(this.getSpringVector());
    }

    act(time) {
        this.pos = this.getNextPosition(time);
    }
}

class Player extends Actor {
    constructor(pos) {
        super(pos, new Vector(0.8, 1.5));
        this.pos.y -= 0.5;

    }

    get type() {
        return 'player';
    }
}

const schemas =
    [
        [
            "     v                 ",
            "                       ",
            "                       ",
            "             x         ",
            "  |         x          ",
            "  o        x           ",
            "  xxxx              o  ",
            "  x               = x  ",
            "  x          o o    x  ",
            "  x  @    *  xxxxx  x  ",
            "  xxxxx             x  ",
            "      x!!!!!!!!!!!!!x  ",
            "      xxxxxxxxxxxxxxx  ",
            "                       "
        ],
        [
            "     v                 ",
            "                       ",
            "                       ",
            "                       ",
            "                       ",
            "  |                    ",
            "  o                 o  ",
            "  x               = x  ",
            "  x          o o    x  ",
            "  x  @       xxxxx  x  ",
            "  xxxxx             x  ",
            "      x!!!!!!!!!!!!!x  ",
            "      xxxxxxxxxxxxxxx  ",
            "                       "
        ],
        [
            "        |           |  ",
            "                       ",
            "                       ",
            "                       ",
            "                       ",
            "                       ",
            "                       ",
            "                       ",
            "                       ",
            "     |                 ",
            "                       ",
            "         =      |      ",
            " @ |  o            o   ",
            "xxxxxxxxx!!!!!!!xxxxxxx",
            "                       "
        ],
        [
            "                       ",
            "                       ",
            "                       ",
            "    o                  ",
            "    x      | x!!x=     ",
            "         x             ",
            "                      x",
            "                       ",
            "                       ",
            "                       ",
            "               xxx     ",
            "                       ",
            "                       ",
            "       xxx  |          ",
            "                       ",
            " @                     ",
            "xxx                    ",
            "                       "
        ], [
            "   v         v",
            "              ",
            "         !o!  ",
            "              ",
            "              ",
            "              ",
            "              ",
            "         xxx  ",
            "          o   ",
            "        =     ",
            "  @           ",
            "  xxxx        ",
            "  |           ",
            "      xxx    x",
            "              ",
            "          !   ",
            "              ",
            "              ",
            " o       x    ",
            " x      x     ",
            "       x      ",
            "      x       ",
            "   xx         ",
            "              "
        ]
    ];
const actorDict = {
    '@': Player,
    'v': FireRain,
    '|': VerticalFireball,
    '=': HorizontalFireball,
    'o': Coin
}
const parser = new LevelParser(actorDict);
const level = parser.parse(schemas[0]);
runGame(schemas, parser, DOMDisplay)
    .then(() => alert('Красавчег, держи приз!'));