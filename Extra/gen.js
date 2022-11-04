const POPULATION_SIZE = 30; 

const POINT_TO_FIND = {
    'x' : 9,
    'y' : 9,
    'z' : 9
};
const RADIUS = 10;
function random_num(start, end)
{
    return start + Math.random()*(end-start);
}

function create_genome()
{
    var xi, yi, zi;
    xi = random_num(-100,100);
    yi = random_num(-100,100);
    zi = random_num(-100,100);
    var div = Math.sqrt(Math.pow(xi,2)+Math.pow(yi,2)+Math.pow(zi,2));
    xi = (1.0*xi)/div;
    yi = (1.0*yi)/div;
    zi = (1.0*zi)/div;

    xi = xi*RADIUS;
    yi = yi*RADIUS;
    zi = zi*RADIUS;
    return new Individual(xi, yi, zi);
}
class Individual{

    constructor(x,y,z)
    {
        this.x = x;
        this.y = y;
        this.z = z;

        this.calculate_fitness();
    }

    mate(ind1)
    {
        // I1: x1,y1,z1
        // I2: x2,y2,z2
        
        var prob = (1.0*random_num(0,100))/100;
        var xi,yi,zi;
        if(prob<0.9)
        {
            // choose p*ind1 + (1-p)*this
            xi = ind1.x*prob + (1-prob)*this.x;
            yi = ind1.y*prob + (1-prob)*this.y;
            zi = ind1.z*prob + (1-prob)*this.z;    
        }
        else
        {
            // random point on the sphere
            xi = random_num(-100,100);
            yi = random_num(-100,100);
            zi = random_num(-100,100);
        }
        var div = Math.sqrt(Math.pow(xi,2),Math.pow(yi,2),Math.pow(zi,2));
        xi = (1.0*xi)/div;
        yi = (1.0*yi)/div;
        zi = (1.0*zi)/div;

        xi = xi*RADIUS;
        yi = yi*RADIUS;
        zi = zi*RADIUS;
        
        return new Individual(xi,yi,zi);
    }

    calculate_fitness()
    {
        // For now keep the fitness as distance from certain source point
        var x_d = Math.pow((this.x - POINT_TO_FIND.x),2);
        var y_d = Math.pow((this.y - POINT_TO_FIND.y),2);
        var z_d = Math.pow((this.z - POINT_TO_FIND.z),2);
        this.fitness = Math.sqrt(x_d + y_d + z_d);

        // Call the opencv function to calculate area
    }
}

function compare(ind1, ind2)
{
    if(ind1.fitness > ind2.fitness)return 0;
    else return 1;
}

function main()
{
    var generation = 0;

    var population = [];

    for(var i=0; i<POPULATION_SIZE; i+=1)
    {
        population.push(create_genome());
    }

    var flag = false;
    while(!flag)
    {
        generation += 1;
        population.sort((a, b) => {
            return a.fitness - b.fitness;
        });

        if(population[0].fitness <= 1.5)
        {
            flag = true;
            break;
        }

        var new_generation = [];

        // retain 10% of the fittest
        var s = POPULATION_SIZE/10;
        for(var i=0; i<s; i+=1)
        {
            new_generation.push(population[i]);
        }
        s = POPULATION_SIZE-s;
        for(var i=0; i<s; i+=1)
        {
            var i1 = Math.floor(random_num(0,POPULATION_SIZE/2));
            var i2 = Math.floor(random_num(0,POPULATION_SIZE/2));
            new_generation.push(population[i1].mate(population[i2]));
        }
        population = new_generation;
        console.log(`Gen: ${generation} Fitness: ${population[0].fitness}`);
    }

    console.log("Answer: ", population[0]);
}

main();