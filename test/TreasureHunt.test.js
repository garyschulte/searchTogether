const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("TreasureHunt", function () {
    let treasureHunt;
    let verifier;
    let hider;
    let seeker1;
    let seeker2;

    const COORDINATE_SCALE = 1000000;
    const RADIUS_SCALED = 100;
    const RADIUS_SQUARED = RADIUS_SCALED * RADIUS_SCALED;

    // Example GPS coordinates (San Francisco)
    const targetLat = 37774900;  // 37.7749° scaled
    const targetLon = -122419400; // -122.4194° scaled

    // Mock location commitment (in production, use Poseidon hash)
    const locationCommitment = ethers.toBigInt("123456789");

    const ONE_DAY = 24 * 60 * 60;
    const FOURTEEN_DAYS = 14 * ONE_DAY;

    beforeEach(async function () {
        [hider, seeker1, seeker2] = await ethers.getSigners();

        // Deploy mock verifier (always returns true for testing)
        const MockVerifier = await ethers.getContractFactory("MockVerifier");
        verifier = await MockVerifier.deploy();

        // Deploy TreasureHunt
        const TreasureHunt = await ethers.getContractFactory("TreasureHunt");
        treasureHunt = await TreasureHunt.deploy(await verifier.getAddress());
    });

    describe("Hunt Creation", function () {
        it("Should create a hunt with initial prize", async function () {
            const prizeAmount = ethers.parseEther("0.1");
            const hintPrice = ethers.parseEther("0.01");

            const tx = await treasureHunt.connect(hider).createHunt(
                locationCommitment,
                ONE_DAY,
                FOURTEEN_DAYS,
                hintPrice,
                { value: prizeAmount }
            );

            await expect(tx)
                .to.emit(treasureHunt, "HuntCreated")
                .withArgs(0, hider.address, locationCommitment, prizeAmount, anyValue);

            const hunt = await treasureHunt.getHunt(0);
            expect(hunt.hider).to.equal(hider.address);
            expect(hunt.locationCommitment).to.equal(locationCommitment);
            expect(hunt.hintPrice).to.equal(hintPrice);
        });

        it("Should reject hunt with zero prize", async function () {
            await expect(
                treasureHunt.connect(hider).createHunt(
                    locationCommitment,
                    ONE_DAY,
                    FOURTEEN_DAYS,
                    ethers.parseEther("0.01"),
                    { value: 0 }
                )
            ).to.be.revertedWith("Must deposit prize");
        });

        it("Should reject hunt with lockout too short", async function () {
            await expect(
                treasureHunt.connect(hider).createHunt(
                    locationCommitment,
                    1000, // Less than 1 day
                    FOURTEEN_DAYS,
                    ethers.parseEther("0.01"),
                    { value: ethers.parseEther("0.1") }
                )
            ).to.be.revertedWith("Lockout too short");
        });
    });

    describe("Hint Purchases", function () {
        beforeEach(async function () {
            await treasureHunt.connect(hider).createHunt(
                locationCommitment,
                ONE_DAY,
                FOURTEEN_DAYS,
                ethers.parseEther("0.01"),
                { value: ethers.parseEther("0.1") }
            );
        });

        it("Should allow purchasing hints", async function () {
            const hintPrice = ethers.parseEther("0.01");

            await expect(
                treasureHunt.connect(seeker1).purchaseHint(0, { value: hintPrice })
            )
                .to.emit(treasureHunt, "HintPurchased")
                .withArgs(0, seeker1.address, hintPrice);

            expect(await treasureHunt.hasPurchasedHint(0, seeker1.address)).to.be.true;
        });

        it("Should reject insufficient payment", async function () {
            await expect(
                treasureHunt.connect(seeker1).purchaseHint(0, { value: ethers.parseEther("0.001") })
            ).to.be.revertedWith("Insufficient payment");
        });

        it("Should reject duplicate purchases", async function () {
            const hintPrice = ethers.parseEther("0.01");
            await treasureHunt.connect(seeker1).purchaseHint(0, { value: hintPrice });

            await expect(
                treasureHunt.connect(seeker1).purchaseHint(0, { value: hintPrice })
            ).to.be.revertedWith("Already purchased");
        });
    });

    describe("Claiming", function () {
        let claimCommitment;

        beforeEach(async function () {
            await treasureHunt.connect(hider).createHunt(
                locationCommitment,
                ONE_DAY,
                FOURTEEN_DAYS,
                ethers.parseEther("0.01"),
                { value: ethers.parseEther("0.1") }
            );

            // Mock claim commitment
            claimCommitment = ethers.toBigInt("987654321");

            // Fast forward past lockout period
            await ethers.provider.send("evm_increaseTime", [ONE_DAY + 1]);
            await ethers.provider.send("evm_mine");
        });

        it("Should allow claiming with valid proof", async function () {
            // Mock proof components
            const pA = [1, 2];
            const pB = [[1, 2], [3, 4]];
            const pC = [5, 6];

            await expect(
                treasureHunt.connect(seeker1).claimTreasure(0, pA, pB, pC, claimCommitment)
            )
                .to.emit(treasureHunt, "ClaimSubmitted")
                .withArgs(0, seeker1.address);

            const hunt = await treasureHunt.getHunt(0);
            expect(hunt.status).to.equal(1); // Claimed

            const claim = await treasureHunt.getClaim(0);
            expect(claim.claimer).to.equal(seeker1.address);
        });

        it("Should reject claim during lockout period", async function () {
            // Create new hunt
            await treasureHunt.connect(hider).createHunt(
                locationCommitment,
                ONE_DAY,
                FOURTEEN_DAYS,
                ethers.parseEther("0.01"),
                { value: ethers.parseEther("0.1") }
            );

            const pA = [1, 2];
            const pB = [[1, 2], [3, 4]];
            const pC = [5, 6];

            await expect(
                treasureHunt.connect(seeker1).claimTreasure(1, pA, pB, pC, claimCommitment)
            ).to.be.revertedWith("Still in lockout period");
        });

        it("Should reject duplicate claims", async function () {
            const pA = [1, 2];
            const pB = [[1, 2], [3, 4]];
            const pC = [5, 6];

            await treasureHunt.connect(seeker1).claimTreasure(0, pA, pB, pC, claimCommitment);

            await expect(
                treasureHunt.connect(seeker2).claimTreasure(0, pA, pB, pC, claimCommitment)
            ).to.be.revertedWith("Hunt not active");
        });
    });

    describe("Withdrawals", function () {
        beforeEach(async function () {
            await treasureHunt.connect(hider).createHunt(
                locationCommitment,
                ONE_DAY,
                FOURTEEN_DAYS,
                ethers.parseEther("0.01"),
                { value: ethers.parseEther("1.0") }
            );

            // Fast forward and claim
            await ethers.provider.send("evm_increaseTime", [ONE_DAY + 1]);
            await ethers.provider.send("evm_mine");

            const pA = [1, 2];
            const pB = [[1, 2], [3, 4]];
            const pC = [5, 6];
            const claimCommitment = ethers.toBigInt("987654321");

            await treasureHunt.connect(seeker1).claimTreasure(0, pA, pB, pC, claimCommitment);
        });

        it("Should allow immediate first withdrawal", async function () {
            const balanceBefore = await ethers.provider.getBalance(seeker1.address);

            const tx = await treasureHunt.connect(seeker1).withdraw(0);
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * receipt.gasPrice;

            const balanceAfter = await ethers.provider.getBalance(seeker1.address);

            // Should have withdrawn 50% (0.5 ETH)
            const withdrawn = balanceAfter - balanceBefore + gasUsed;
            expect(withdrawn).to.be.closeTo(ethers.parseEther("0.5"), ethers.parseEther("0.01"));
        });

        it("Should enforce 24-hour withdrawal interval", async function () {
            await treasureHunt.connect(seeker1).withdraw(0);

            await expect(
                treasureHunt.connect(seeker1).withdraw(0)
            ).to.be.revertedWith("Withdrawal too soon");
        });

        it("Should allow second withdrawal after 24 hours", async function () {
            await treasureHunt.connect(seeker1).withdraw(0);

            // Fast forward 24 hours
            await ethers.provider.send("evm_increaseTime", [ONE_DAY]);
            await ethers.provider.send("evm_mine");

            await expect(
                treasureHunt.connect(seeker1).withdraw(0)
            ).to.emit(treasureHunt, "Withdrawal");
        });

        it("Should only allow claimer to withdraw", async function () {
            await expect(
                treasureHunt.connect(seeker2).withdraw(0)
            ).to.be.revertedWith("Not the claimer");
        });
    });

    describe("Hunt Expiration", function () {
        it("Should allow hider to reclaim funds after expiration", async function () {
            await treasureHunt.connect(hider).createHunt(
                locationCommitment,
                ONE_DAY,
                FOURTEEN_DAYS,
                ethers.parseEther("0.01"),
                { value: ethers.parseEther("0.1") }
            );

            // Fast forward past expiration
            await ethers.provider.send("evm_increaseTime", [FOURTEEN_DAYS + 1]);
            await ethers.provider.send("evm_mine");

            await expect(
                treasureHunt.connect(hider).expireHunt(0)
            ).to.emit(treasureHunt, "HuntExpired");

            const hunt = await treasureHunt.getHunt(0);
            expect(hunt.status).to.equal(2); // Expired
        });

        it("Should reject expiration before time", async function () {
            await treasureHunt.connect(hider).createHunt(
                locationCommitment,
                ONE_DAY,
                FOURTEEN_DAYS,
                ethers.parseEther("0.01"),
                { value: ethers.parseEther("0.1") }
            );

            await expect(
                treasureHunt.connect(hider).expireHunt(0)
            ).to.be.revertedWith("Not expired yet");
        });
    });
});
