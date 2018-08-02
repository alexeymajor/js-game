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

        return this.left < actor.right
            && this.right > actor.left
            && this.top < actor.bottom
            && this.bottom > actor.top;
    }

}

class Level {
    constructor(grid=[], actors=[]) {

        this.grid = grid.slice();
        this.actors = actors.slice();

        this.player = actors.find(actor => actor.type === 'player');

        this.status = null;

        this.finishDelay = 1;

        this.height = grid.length;

        this.width = grid.reduce((width, row) => row.length > width ? row.length : width, 0);
    }

    isFinished() {
        return this.status !== null && this.finishDelay < 0;
    }

    actorAt(actor) {
        return this.actors.find(value => actor.isIntersect(value));
    }

    obstacleAt(pos, size) {

        const bottom = Math.ceil(pos.y + size.y);
        const top = Math.floor(pos.y);
        const left =  Math.floor(pos.x);
        const right = Math.ceil(pos.x + size.x);

        if (bottom > this.height) {
            return 'lava';
        }

        if (left < 0 || right > this.width || top < 0) {
            return 'wall';
        }

        for (let col = top; col < bottom; col++) {
            for(let row = left; row < right; row++) {
                const intersection = this.grid[col][row];
                if (intersection) {
                    return intersection;
                }
            }
        }
    }

    removeActor(actor) {
        const i = this.actors.indexOf(actor);

        if (i >= 0) {
            this.actors.splice(i, 1);
        }
    }

    noMoreActors(type) {
        return !this.actors.some(value => value.type === type);
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
            }
        }
    }
}

class LevelParser {

    constructor(actorsMap={}) {
        this.actorsMap = Object.assign({}, actorsMap);

        this.obstacles = {
            'x': 'wall',
            '!': 'lava'
        }
    }

    actorFromSymbol(symbol) {
        return this.actorsMap[symbol];
    }

    obstacleFromSymbol(symbol) {
        return this.obstacles[symbol];
    }

    createGrid(gridStr=[]) {
        return gridStr.map(
            line => line.split('').map(
                symbol => this.obstacleFromSymbol(symbol)
            )
        );

    }

    createActors(str) {
        return str.reduce((actors, line, col) => {
            actors = line.split('').reduce((memo, symbol, row) => {
                const ActorRef = this.actorFromSymbol(symbol);
                if (typeof ActorRef !== 'function') {
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
        return this.pos.plus( this.speed.times(time) );
    }

    handleObstacle() {
        this.speed = this.speed.times(-1);
    }

    act(time, level) {
        const nextPos = this.getNextPosition(time);

        if (level.obstacleAt(nextPos, this.size)) {
            this.handleObstacle();
            return;
        }

        this.pos = nextPos;
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
        this.defaultPos = pos;
    }

    handleObstacle() {
        this.pos = this.defaultPos;
    }
}

class Coin extends Actor {
    constructor(pos=new Vector(0,0)) {
        const coinPos = pos.plus(new Vector(0.2, 0.1));
        const coinSize = new Vector(0.6, 0.6);

        super(coinPos, coinSize, new Vector(0,0));
        this.defaultPos = coinPos;
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
    constructor(pos=new Vector(0,0)) {
        const startPos = pos.plus(new Vector(0, -0.5));
        const playerSize = new Vector(0.8, 1.5);

        super(startPos, playerSize, new Vector(0,0));
    }

    get type() {
        return 'player';
    }
}

const actorDict = {
    '@': Player,
    'v': FireRain,
    '|': VerticalFireball,
    '=': HorizontalFireball,
    'o': Coin
};

const parser = new LevelParser(actorDict);

loadLevels()
    .then(levels => runGame(JSON.parse(levels), parser, DOMDisplay)
        .then(() => alert('Красавчег, держи приз!'))
    );
