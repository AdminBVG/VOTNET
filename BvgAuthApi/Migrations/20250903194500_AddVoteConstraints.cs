using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BvgAuthApi.Migrations
{
    public partial class AddVoteConstraints : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Votes_ElectionOptionId",
                table: "Votes",
                column: "ElectionOptionId");

            migrationBuilder.CreateIndex(
                name: "IX_Votes_ElectionQuestionId",
                table: "Votes",
                column: "ElectionQuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_Votes_PadronEntryId",
                table: "Votes",
                column: "PadronEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_Votes_UniqueVote",
                table: "Votes",
                columns: new[] { "ElectionId", "PadronEntryId", "ElectionQuestionId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Votes_Padron_PadronEntryId",
                table: "Votes",
                column: "PadronEntryId",
                principalTable: "Padron",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Votes_Questions_ElectionQuestionId",
                table: "Votes",
                column: "ElectionQuestionId",
                principalTable: "Questions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Votes_Options_ElectionOptionId",
                table: "Votes",
                column: "ElectionOptionId",
                principalTable: "Options",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Votes_Padron_PadronEntryId",
                table: "Votes");

            migrationBuilder.DropForeignKey(
                name: "FK_Votes_Questions_ElectionQuestionId",
                table: "Votes");

            migrationBuilder.DropForeignKey(
                name: "FK_Votes_Options_ElectionOptionId",
                table: "Votes");

            migrationBuilder.DropIndex(
                name: "IX_Votes_ElectionOptionId",
                table: "Votes");

            migrationBuilder.DropIndex(
                name: "IX_Votes_ElectionQuestionId",
                table: "Votes");

            migrationBuilder.DropIndex(
                name: "IX_Votes_PadronEntryId",
                table: "Votes");

            migrationBuilder.DropIndex(
                name: "IX_Votes_UniqueVote",
                table: "Votes");
        }
    }
}
